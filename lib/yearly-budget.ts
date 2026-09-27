/** 年間予算の予実を構築する純関数。年間予算額の出所・定義は呼び出し側に委ねる。 */

export type YearlyBudgetInput = {
  category_id: string;
  amount: number;
};

type AnnualExpenseSlice = {
  categoryId: string | null;
  amount: number;
};

export type YearlyBudgetRow = {
  categoryId: string;
  name: string;
  color: string;
  annualBudget: number;
  actual: number;
  pct: number;
  over: boolean;
};

export type YearlyBudgetSummary = {
  rows: YearlyBudgetRow[];
  totalBudget: number;
  totalActual: number;
  totalPct: number;
  over: boolean;
};

type CategoryInfo = { id: string; name: string; color: string | null };

const DEFAULT_COLOR = "#999";

/** 年間予算額と年間支出スライスをカテゴリごとに突き合わせる。 */
export function buildYearlyBudget(
  budgets: YearlyBudgetInput[],
  annualExpenseSlices: AnnualExpenseSlice[],
  categories: CategoryInfo[],
): YearlyBudgetSummary {
  const budgetByCategory = new Map(budgets.map((b) => [b.category_id, b.amount]));
  const actualByCategory = new Map(
    annualExpenseSlices
      .filter((s): s is AnnualExpenseSlice & { categoryId: string } => s.categoryId !== null)
      .map((s) => [s.categoryId, s.amount]),
  );

  const rows = categories.map((category) => {
    const annualBudget = budgetByCategory.get(category.id) ?? 0;
    const actual = actualByCategory.get(category.id) ?? 0;
    return {
      categoryId: category.id,
      name: category.name,
      color: category.color ?? DEFAULT_COLOR,
      annualBudget,
      actual,
      pct: annualBudget > 0 ? Math.round((actual / annualBudget) * 100) : 0,
      over: annualBudget > 0 && actual > annualBudget,
    };
  });

  const budgetedRows = rows.filter((row) => row.annualBudget > 0);
  const totalBudget = budgetedRows.reduce((sum, row) => sum + row.annualBudget, 0);
  const totalActual = budgetedRows.reduce((sum, row) => sum + row.actual, 0);

  return {
    rows,
    totalBudget,
    totalActual,
    totalPct: totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0,
    over: totalBudget > 0 && totalActual > totalBudget,
  };
}
