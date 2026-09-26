/**
 * 家計アドバイスの生成ロジック（純関数・ルールベース）。
 *
 * 当期の集計（trend / カテゴリ別支出 / 予実）を入力に取り、決定的なルールで
 * 助言を生成する。同じ入力なら同じ出力。DB やランダム性に依存しない。
 * 深刻度（alert > warn > good > info）優先で並べ、上位最大 MAX_ADVICE 件に絞る。
 */

import type { CategorySlice, CategoryTrend } from "./analytics";
import type { BudgetSummary } from "./budget";
import { yen } from "./format";
import type { CategoryYoY } from "./yearly-analytics";

export type AdviceSeverity = "alert" | "warn" | "good" | "info";

/** 1件のアドバイス。 */
export type Advice = {
  /** ルール識別子（重複排除・テスト用）。カテゴリ別超過は `budget-over:<id>`。 */
  id: string;
  severity: AdviceSeverity;
  /** 一行サマリ。 */
  title: string;
  /** 改善提案 or 補足（称賛時は労い）。 */
  detail: string;
};

export type AdviceInput = {
  income: number;
  expense: number;
  prevIncome: number;
  prevExpense: number;
  /** 直近6期の支出（古い→新しい、当期含む）。 */
  expenseTrend: number[];
  /** 当期カテゴリ別支出（金額降順）。 */
  categories: CategorySlice[];
  /** 固定費とみなすカテゴリID（定期収支に紐づく支出カテゴリ）。集中度の母数から除く。 */
  fixedCategoryIds: string[];
  /** カテゴリ別の期別支出推移（当期が末尾）。「いつもより増えた」検知に使う。 */
  categoryTrends: CategoryTrend[];
  /** buildBudgetRows の出力（予算未設定なら rows: []）。 */
  budget: BudgetSummary;
};

// ルールのしきい値
const LOW_SAVINGS_RATE = 0.1; // これ未満で貯蓄率低下を警告
const GOOD_SAVINGS_RATE = 0.2; // これ以上で貯蓄率良好を称賛
const SAVINGS_IMPROVE_DELTA = 0.05; // 前期比でこれを超える改善を称賛
const CONCENTRATION_SHARE = 0.5; // 最多カテゴリがこの占有率以上で集中を指摘
const MIN_VARIABLE_CATS = 2; // 集中度はこの数以上の変動費カテゴリがある時のみ判定
const SPIKE_RATIO = 1.4; // 当期がこの倍率超で直近平均を上回ったら「増えた」とみなす
const SPIKE_MIN_DELTA = 5000; // 増加額がこれ未満はノイズとして無視
const MAX_SPIKES = 2; // スパイク指摘の最大件数
const EXPENSE_UP_RATIO = 1.2; // 前期比でこの倍率超の増加を警告
const EXPENSE_DOWN_RATIO = 0.9; // 前期比でこの倍率未満の減少を称賛
const MAX_BUDGET_OVER = 2; // カテゴリ別超過アラートの最大件数
const MAX_ADVICE = 5; // 表示する最大件数

const RANK: Record<AdviceSeverity, number> = {
  alert: 0,
  warn: 1,
  good: 2,
  info: 3,
};

function savingsRate(income: number, expense: number): number {
  return income > 0 ? (income - expense) / income : 0;
}

export function buildAdvice(input: AdviceInput): Advice[] {
  const {
    income,
    expense,
    prevIncome,
    prevExpense,
    expenseTrend,
    categories,
    fixedCategoryIds,
    categoryTrends,
    budget,
  } = input;

  // データ不足時は案内のみ
  if (income <= 0 && expense <= 0) {
    return [
      {
        id: "no-data",
        severity: "info",
        title: "まだ分析できる支出がありません",
        detail: "収支を記録すると、ここに家計のアドバイスが表示されます。",
      },
    ];
  }

  const out: Advice[] = [];

  // ④ 貯蓄率・収支バランス
  if (expense > income) {
    out.push({
      id: "deficit",
      severity: "alert",
      title: `今期は支出が収入を ${yen(expense - income)} 上回っています`,
      detail: "固定費や大きな出費を見直して、収支のバランスを整えましょう。",
    });
  } else {
    const rate = savingsRate(income, expense);
    const pct = Math.round(rate * 100);
    if (rate < LOW_SAVINGS_RATE) {
      out.push({
        id: "low-savings",
        severity: "warn",
        title: `貯蓄率が ${pct}% と低めです`,
        detail: "固定費の見直しや、支出の多いカテゴリの節約を検討しましょう。",
      });
    } else if (rate >= GOOD_SAVINGS_RATE) {
      out.push({
        id: "good-savings",
        severity: "good",
        title: `貯蓄率 ${pct}% を達成しています`,
        detail: "順調に貯蓄できています。この調子で続けましょう。",
      });
    }

    if (prevIncome > 0) {
      const prevRate = savingsRate(prevIncome, prevExpense);
      if (rate > prevRate + SAVINGS_IMPROVE_DELTA) {
        out.push({
          id: "improved-savings",
          severity: "good",
          title: "貯蓄率が前期より改善しています",
          detail: `前期 ${Math.round(prevRate * 100)}% → 今期 ${pct}% に向上しました。`,
        });
      }
    }
  }

  // ① 予算超過
  const overRows = [...budget.rows]
    .filter((r) => r.over)
    .sort((a, b) => b.spent - b.budget - (a.spent - a.budget));
  for (const r of overRows.slice(0, MAX_BUDGET_OVER)) {
    out.push({
      id: `budget-over:${r.categoryId}`,
      severity: "alert",
      title: `「${r.name}」が予算を ${yen(r.spent - r.budget)} 超過しています`,
      detail: `予算 ${yen(r.budget)} に対し実績 ${yen(r.spent)}（${r.pct}%）です。`,
    });
  }
  const hasBudget = budget.rows.some((r) => r.budget > 0);
  if (hasBudget) {
    if (budget.over) {
      out.push({
        id: "budget-over-total",
        severity: "warn",
        title: `予算合計を ${yen(budget.totalSpent - budget.totalBudget)} 超過しています`,
        detail: `合計予算 ${yen(budget.totalBudget)} に対し実績 ${yen(budget.totalSpent)} です。`,
      });
    } else if (overRows.length === 0) {
      out.push({
        id: "budget-within",
        severity: "good",
        title: "すべてのカテゴリが予算内です",
        detail: "計画どおりに支出をコントロールできています。",
      });
    }
  }

  // ③ カテゴリ集中度（固定費は母数から除外する。家賃など一定の固定費が
  //    トップを占めるのは当然なので指摘しても行動に繋がらないため）
  const fixedSet = new Set(fixedCategoryIds);
  const variableCats = categories.filter(
    (c) => c.categoryId === null || !fixedSet.has(c.categoryId),
  );
  const variableTotal = variableCats.reduce((s, c) => s + c.amount, 0);
  if (variableTotal > 0 && variableCats.length >= MIN_VARIABLE_CATS) {
    const top = variableCats.reduce(
      (m, c) => (c.amount > m.amount ? c : m),
      variableCats[0],
    );
    const share = top.amount / variableTotal;
    if (share >= CONCENTRATION_SHARE) {
      out.push({
        id: "category-concentration",
        severity: "info",
        title: `固定費を除く支出の ${Math.round(share * 100)}% が「${top.name}」に集中しています`,
        detail: "やりくり支出が偏っています。内訳に見直す余地がないか確認しましょう。",
      });
    }
  }

  // ② 支出トレンド
  if (prevExpense > 0) {
    if (expense > prevExpense * EXPENSE_UP_RATIO) {
      const pct = Math.round(((expense - prevExpense) / prevExpense) * 100);
      out.push({
        id: "expense-up",
        severity: "warn",
        title: `支出が前期比 +${pct}% 増えています`,
        detail: `前期 ${yen(prevExpense)} → 今期 ${yen(expense)} に増加しました。`,
      });
    } else if (expense < prevExpense * EXPENSE_DOWN_RATIO) {
      const pct = Math.round(((prevExpense - expense) / prevExpense) * 100);
      out.push({
        id: "expense-down",
        severity: "good",
        title: `支出を前期比 ${pct}% 抑えられています`,
        detail: `前期 ${yen(prevExpense)} → 今期 ${yen(expense)} に減少しました。`,
      });
    }
  }
  if (expenseTrend.length >= 3) {
    const [a, b, c] = expenseTrend.slice(-3);
    if (a < b && b < c) {
      out.push({
        id: "expense-up-3",
        severity: "warn",
        title: "3期連続で支出が増加しています",
        detail: "支出が増え続けています。早めに要因を確認しましょう。",
      });
    }
  }

  // ⑤ カテゴリ別スパイク（当期が直近平均より大きく増えたカテゴリだけを指摘）
  const spikes = categoryTrends
    .map((ct) => {
      const current = ct.amounts[ct.amounts.length - 1] ?? 0;
      const prior = ct.amounts.slice(0, -1);
      const baseline = prior.length
        ? prior.reduce((s, n) => s + n, 0) / prior.length
        : 0;
      return { categoryId: ct.categoryId, name: ct.name, current, baseline };
    })
    .filter(
      (s) =>
        s.baseline > 0 &&
        s.current > s.baseline * SPIKE_RATIO &&
        s.current - s.baseline >= SPIKE_MIN_DELTA,
    )
    .sort((a, b) => b.current - b.baseline - (a.current - a.baseline));
  for (const s of spikes.slice(0, MAX_SPIKES)) {
    const pct = Math.round(((s.current - s.baseline) / s.baseline) * 100);
    out.push({
      id: `category-spike:${s.categoryId ?? "none"}`,
      severity: "warn",
      title: `「${s.name}」が直近の平均より +${pct}% 増えています`,
      detail: `直近の平均 ${yen(Math.round(s.baseline))} に対し今期 ${yen(s.current)} です。`,
    });
  }

  // 深刻度優先で安定ソートし、上位を返す
  out.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
  return out.slice(0, MAX_ADVICE);
}

/** 年間アドバイスの入力（前年は「前年同期」= 当年の経過期数ぶん）。 */
export type YearlyAdviceInput = {
  income: number;
  expense: number;
  prevIncome: number;
  prevExpense: number;
  /** 当年の経過期数（0〜12）。 */
  elapsed: number;
  /** 経過期あたりの支出。 */
  avgExpense: number;
  /** 支出最多の期。 */
  peakExpense: { label: string; amount: number } | null;
  /** カテゴリ別の前年同期比較（compareCategoryYoY の出力）。 */
  categoryYoY: CategoryYoY[];
};

// 年間ルールのしきい値
const YEAR_EXPENSE_UP_RATIO = 1.1; // 前年同期比でこの倍率超の増加を警告
const YEAR_EXPENSE_DOWN_RATIO = 0.9; // 前年同期比でこの倍率未満の減少を称賛
const YEAR_PEAK_RATIO = 1.5; // 月平均のこの倍率以上の月を「突出」とみなす
const YEAR_PEAK_MIN_ELAPSED = 2; // 突出月はこの期数以上経過している時のみ判定
const YEAR_CATEGORY_UP_RATIO = 0.2; // 前年比でこの割合以上増えたカテゴリを指摘
const YEAR_CATEGORY_UP_MIN_DELTA = 10000; // 増加額がこれ未満は無視
const MAX_YEAR_CATEGORY_UP = 2; // カテゴリ増加指摘の最大件数

/** 年間の集計から決定的なルールで助言を生成する（深刻度優先・最大 MAX_ADVICE 件）。 */
export function buildYearlyAdvice(input: YearlyAdviceInput): Advice[] {
  const {
    income,
    expense,
    prevExpense,
    elapsed,
    avgExpense,
    peakExpense,
    categoryYoY,
  } = input;

  if (income <= 0 && expense <= 0) {
    return [
      {
        id: "year-no-data",
        severity: "info",
        title: "この年の収支はまだありません",
        detail: "収支を記録すると、ここに1年の振り返りが表示されます。",
      },
    ];
  }

  const out: Advice[] = [];

  // 年間の貯蓄率・収支バランス
  if (expense > income) {
    out.push({
      id: "year-deficit",
      severity: "alert",
      title: `年間で支出が収入を ${yen(expense - income)} 上回っています`,
      detail: "固定費や大きな出費を見直して、来年の収支を立て直しましょう。",
    });
  } else {
    const rate = savingsRate(income, expense);
    const pct = Math.round(rate * 100);
    if (rate < LOW_SAVINGS_RATE) {
      out.push({
        id: "year-low-savings",
        severity: "warn",
        title: `年間の貯蓄率が ${pct}% と低めです`,
        detail: "支出の多いカテゴリから、無理のない節約目標を立ててみましょう。",
      });
    } else if (rate >= GOOD_SAVINGS_RATE) {
      out.push({
        id: "year-good-savings",
        severity: "good",
        title: `年間の貯蓄率 ${pct}% を達成しています`,
        detail: "1年を通して順調に貯蓄できています。",
      });
    }
  }

  // 前年同期比の支出
  if (prevExpense > 0) {
    if (expense > prevExpense * YEAR_EXPENSE_UP_RATIO) {
      const pct = Math.round(((expense - prevExpense) / prevExpense) * 100);
      out.push({
        id: "year-expense-up",
        severity: "warn",
        title: `支出が前年同期比 +${pct}% 増えています`,
        detail: `前年 ${yen(prevExpense)} → 今年 ${yen(expense)} に増加しました。`,
      });
    } else if (expense < prevExpense * YEAR_EXPENSE_DOWN_RATIO) {
      const pct = Math.round(((prevExpense - expense) / prevExpense) * 100);
      out.push({
        id: "year-expense-down",
        severity: "good",
        title: `支出を前年同期比 ${pct}% 抑えられています`,
        detail: `前年 ${yen(prevExpense)} → 今年 ${yen(expense)} に減少しました。`,
      });
    }
  }

  // 前年比で増えたカテゴリ
  const ups = categoryYoY
    .filter(
      (c) =>
        c.prevAmount > 0 &&
        c.diff >= YEAR_CATEGORY_UP_MIN_DELTA &&
        c.ratio !== null &&
        c.ratio >= YEAR_CATEGORY_UP_RATIO,
    )
    .sort((a, b) => b.diff - a.diff);
  for (const c of ups.slice(0, MAX_YEAR_CATEGORY_UP)) {
    out.push({
      id: `year-category-up:${c.categoryId ?? "none"}`,
      severity: "warn",
      title: `「${c.name}」が前年より ${yen(c.diff)} 増えています`,
      detail: `前年 ${yen(c.prevAmount)} → 今年 ${yen(c.amount)}（+${Math.round((c.ratio ?? 0) * 100)}%）です。`,
    });
  }

  // 支出が突出した月
  if (
    peakExpense &&
    elapsed >= YEAR_PEAK_MIN_ELAPSED &&
    avgExpense > 0 &&
    peakExpense.amount >= avgExpense * YEAR_PEAK_RATIO
  ) {
    out.push({
      id: "year-peak-month",
      severity: "info",
      title: `${peakExpense.label}の支出が突出しています`,
      detail: `月平均 ${yen(avgExpense)} に対し ${yen(peakExpense.amount)} でした。特別な出費は来年の計画に織り込みましょう。`,
    });
  }

  out.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
  return out.slice(0, MAX_ADVICE);
}
