/**
 * 予算管理（予実）の集計ロジック（純関数）。
 *
 * カテゴリ別の予算額と当期の実績支出（lib/analytics.ts#summarizeCategoryExpense）を
 * 突き合わせ、進捗率・超過判定と合計を求める。DB ではなく JS 側で集計しテストで検証する。
 */

import type { CategorySlice } from "@/lib/analytics";

/** 1カテゴリぶんの予実行。 */
export type BudgetRow = {
  categoryId: string;
  name: string;
  color: string;
  /** 設定された予算額。未設定は 0。 */
  budget: number;
  /** 当期の実績支出。 */
  spent: number;
  /** budget>0 のとき round(spent/budget*100)、それ以外 0。 */
  pct: number;
  /** budget>0 かつ spent>budget。 */
  over: boolean;
};

/** 予実の集計結果。 */
export type BudgetSummary = {
  rows: BudgetRow[];
  /** 予算設定済みカテゴリの予算合計。 */
  totalBudget: number;
  /** 予算設定済みカテゴリの実績合計。 */
  totalSpent: number;
  /** totalBudget>0 のとき round(totalSpent/totalBudget*100)、それ以外 0。 */
  totalPct: number;
  /** totalBudget>0 かつ totalSpent>totalBudget。 */
  over: boolean;
};

type BudgetInput = { category_id: string; amount: number };
type CategoryInfo = { id: string; name: string; color: string | null };

const DEFAULT_COLOR = "#999";

function pctOf(spent: number, budget: number): number {
  return budget > 0 ? Math.round((spent / budget) * 100) : 0;
}

/**
 * カテゴリ一覧・予算・実績スライスから予実行と合計を構築する。
 * 行はカテゴリ一覧の順序を保つ。合計は予算設定済みカテゴリのみを対象とする。
 */
export function buildBudgetRows(
  budgets: BudgetInput[],
  expenseSlices: CategorySlice[],
  categories: CategoryInfo[],
): BudgetSummary {
  const budgetByCategory = new Map(budgets.map((b) => [b.category_id, b.amount]));
  const spentByCategory = new Map(
    expenseSlices
      .filter((s): s is CategorySlice & { categoryId: string } => s.categoryId !== null)
      .map((s) => [s.categoryId, s.amount]),
  );

  const rows: BudgetRow[] = categories.map((c) => {
    const budget = budgetByCategory.get(c.id) ?? 0;
    const spent = spentByCategory.get(c.id) ?? 0;
    return {
      categoryId: c.id,
      name: c.name,
      color: c.color ?? DEFAULT_COLOR,
      budget,
      spent,
      pct: pctOf(spent, budget),
      over: budget > 0 && spent > budget,
    };
  });

  let totalBudget = 0;
  let totalSpent = 0;
  for (const row of rows) {
    if (row.budget <= 0) continue;
    totalBudget += row.budget;
    totalSpent += row.spent;
  }

  return {
    rows,
    totalBudget,
    totalSpent,
    totalPct: pctOf(totalSpent, totalBudget),
    over: totalBudget > 0 && totalSpent > totalBudget,
  };
}
