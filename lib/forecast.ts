/**
 * 月末着地予測の算出（純関数）。
 *
 * 当期の途中時点で、期末（締め日区切り）に収入・支出・収支がいくらで着地するかを
 * 予測する。定期収支（固定費・固定収入）は期首に計上済みのため、支出合計をそのまま
 * 日割り外挿すると過大予測になる。そこで `recurring_id` の有無で固定/変動を分け、
 * 固定は満額・変動だけを経過日数で日割り外挿する「ハイブリッド方式」を採る。
 * ただし収入は外挿しない（固定収入は期首計上済み、変動収入は一回限りで日数に
 * 比例しないため）。外挿対象は変動支出のみ。
 *
 * 期間は lib/period.ts の半開区間 [start, end)・UTC 真夜中基準を踏襲する。
 */

import type { PeriodRange } from "./period";

const MS_PER_DAY = 86_400_000;

/** 予測入力（DB 行をアプリ向けに写したもの）。 */
export type ForecastTx = {
  amount: number;
  type: "income" | "expense";
  /** null = 変動（外挿対象）／非 null = 定期由来の固定（満額）。 */
  recurring_id: string | null;
};

/** 着地予測の算出結果。 */
export type Forecast = {
  /** 期間の総日数 (end - start)。 */
  totalDays: number;
  /** 経過日数。[1, totalDays] にクランプ。 */
  daysElapsed: number;
  /** 残り日数 totalDays - daysElapsed。 */
  daysRemaining: number;
  /** 実績（固定+変動）。 */
  actualIncome: number;
  actualExpense: number;
  /** 着地収入 = 実額（外挿しない。actualIncome と一致）。 */
  projectedIncome: number;
  /** 着地支出 = 固定満額 + 変動×factor を四捨五入。 */
  projectedExpense: number;
  /** projectedIncome - projectedExpense。 */
  projectedBalance: number;
  /** 変動に掛ける外挿係数 totalDays/daysElapsed (>= 1)。 */
  factor: number;
};

/** Date を UTC の年月日 0 時のミリ秒に正規化する。 */
function utcDayMs(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** ref を含む期間の経過日数・外挿係数を求める。 */
function paceFor(range: PeriodRange, today: Date) {
  const totalDays = Math.round(
    (range.end.getTime() - range.start.getTime()) / MS_PER_DAY,
  );
  const elapsedRaw =
    Math.floor((utcDayMs(today) - range.start.getTime()) / MS_PER_DAY) + 1;
  const daysElapsed = Math.min(Math.max(elapsedRaw, 1), totalDays);
  return {
    totalDays,
    daysElapsed,
    daysRemaining: totalDays - daysElapsed,
    factor: totalDays / daysElapsed,
  };
}

export function buildForecast(
  txs: ForecastTx[],
  range: PeriodRange,
  today: Date,
): Forecast {
  const { totalDays, daysElapsed, daysRemaining, factor } = paceFor(
    range,
    today,
  );

  let fixedIncome = 0;
  let fixedExpense = 0;
  let varIncome = 0;
  let varExpense = 0;
  for (const t of txs) {
    const fixed = t.recurring_id != null;
    if (t.type === "income") {
      if (fixed) fixedIncome += t.amount;
      else varIncome += t.amount;
    } else {
      if (fixed) fixedExpense += t.amount;
      else varExpense += t.amount;
    }
  }

  // 収入は外挿しない。固定収入（給料）は期首に満額計上済み、変動収入（臨時収入・
  // ボーナス・返金など）は一回限りで日数に比例しないため、実額のまま計上する。
  // 変動支出（食費・買い物）だけが日々積み上がるので日割り外挿の対象とする。
  const projectedIncome = fixedIncome + varIncome;
  const projectedExpense = Math.round(fixedExpense + varExpense * factor);

  return {
    totalDays,
    daysElapsed,
    daysRemaining,
    actualIncome: fixedIncome + varIncome,
    actualExpense: fixedExpense + varExpense,
    projectedIncome,
    projectedExpense,
    projectedBalance: projectedIncome - projectedExpense,
    factor,
  };
}

/** 予算（予実）連携の着地予測。 */
export type ForecastBudget = {
  /** 予算設定済みカテゴリの予算合計。 */
  totalBudget: number;
  /** 同カテゴリの着地支出（固定満額 + 変動×factor）。 */
  projectedSpent: number;
  /** max(projectedSpent - totalBudget, 0)。 */
  overBy: number;
  /** projectedSpent > totalBudget。 */
  willOverrun: boolean;
};

/**
 * 予算設定済みカテゴリの支出について、固定/変動を分け factor で変動だけ外挿し
 * 着地支出を予測、予算合計と対比する。予算未設定なら null。
 */
export function buildForecastBudget(
  budgets: { category_id: string; amount: number }[],
  txs: {
    amount: number;
    type: "income" | "expense";
    recurring_id: string | null;
    category_id: string | null;
  }[],
  forecast: Forecast,
): ForecastBudget | null {
  const budgeted = budgets.filter((b) => b.amount > 0);
  if (budgeted.length === 0) return null;

  const budgetedIds = new Set(budgeted.map((b) => b.category_id));
  let fixed = 0;
  let variable = 0;
  for (const t of txs) {
    if (t.type !== "expense" || !t.category_id) continue;
    if (!budgetedIds.has(t.category_id)) continue;
    if (t.recurring_id != null) fixed += t.amount;
    else variable += t.amount;
  }

  const projectedSpent = Math.round(fixed + variable * forecast.factor);
  const totalBudget = budgeted.reduce((s, b) => s + b.amount, 0);

  return {
    totalBudget,
    projectedSpent,
    overBy: Math.max(projectedSpent - totalBudget, 0),
    willOverrun: projectedSpent > totalBudget,
  };
}
