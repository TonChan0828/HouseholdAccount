/**
 * 月次分析の集計ロジック（純関数）。
 *
 * DB ではなく JS 側で集計し、ユニットテストで検証する。
 * 期間は半開区間 `[start, end)` で扱う（`lib/period.ts` と同じ）。
 */

import type { PeriodRange } from "@/lib/period";

export type TxLite = {
  amount: number;
  type: "income" | "expense";
  date: string; // YYYY-MM-DD
  category_id: string | null;
  category: { name: string; color: string | null } | null;
};

/** 月別推移の1期ぶん。 */
export type PeriodSummary = {
  label: string;
  income: number;
  expense: number;
};

/** 当期収支グラフの1本ぶん（収入 or 支出）。 */
export type BalanceBar = {
  label: string;
  amount: number;
  key: "income" | "expense";
};

/** カテゴリ別内訳の1項目。 */
export type CategorySlice = {
  categoryId: string | null;
  name: string;
  color: string;
  amount: number;
};

const UNCATEGORIZED_NAME = "未分類";
const UNCATEGORIZED_COLOR = "#999";

/** 期の開始日を `MM/DD〜` ラベルにする（UTC 基準）。 */
function periodLabel(range: PeriodRange): string {
  const iso = range.start.toISOString().slice(0, 10); // YYYY-MM-DD
  const [, mm, dd] = iso.split("-");
  return `${mm}/${dd}〜`;
}

/** 各期の収入・支出を期バケットへ集計する。 */
export function summarizeTrend(
  txs: TxLite[],
  ranges: PeriodRange[],
): PeriodSummary[] {
  return ranges.map((range) => {
    const start = range.start.toISOString().slice(0, 10);
    const end = range.end.toISOString().slice(0, 10);
    let income = 0;
    let expense = 0;
    for (const t of txs) {
      if (t.date < start || t.date >= end) continue;
      if (t.type === "income") income += t.amount;
      else expense += t.amount;
    }
    return { label: periodLabel(range), income, expense };
  });
}

/** 当期の収入・支出を収入→支出の順で棒グラフ用データにする。 */
export function buildBalanceBars(
  income: number,
  expense: number,
): BalanceBar[] {
  return [
    { label: "収入", amount: income, key: "income" },
    { label: "支出", amount: expense, key: "expense" },
  ];
}

/** 支出をカテゴリ別に集計し、金額降順で返す。未設定は「未分類」に集約する。 */
export function summarizeCategoryExpense(txs: TxLite[]): CategorySlice[] {
  const byCategory = new Map<string, CategorySlice>();

  for (const t of txs) {
    if (t.type !== "expense") continue;
    const key = t.category_id ?? "__none__";
    const existing = byCategory.get(key);
    if (existing) {
      existing.amount += t.amount;
      continue;
    }
    byCategory.set(key, {
      categoryId: t.category_id,
      name: t.category?.name ?? UNCATEGORIZED_NAME,
      color: t.category?.color ?? UNCATEGORIZED_COLOR,
      amount: t.amount,
    });
  }

  return [...byCategory.values()].sort((a, b) => b.amount - a.amount);
}
