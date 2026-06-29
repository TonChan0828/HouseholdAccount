import { describe, expect, it } from "vitest";

import { buildAdvice, type AdviceInput } from "./advice";
import type { CategorySlice } from "./analytics";
import type { BudgetRow, BudgetSummary } from "./budget";

const slice = (
  categoryId: string,
  name: string,
  amount: number,
): CategorySlice => ({ categoryId, name, color: "#abc", amount });

const budgetRow = (
  categoryId: string,
  name: string,
  budget: number,
  spent: number,
): BudgetRow => ({
  categoryId,
  name,
  color: "#abc",
  budget,
  spent,
  pct: budget > 0 ? Math.round((spent / budget) * 100) : 0,
  over: budget > 0 && spent > budget,
});

const budgetSummary = (rows: BudgetRow[]): BudgetSummary => {
  let totalBudget = 0;
  let totalSpent = 0;
  for (const r of rows) {
    if (r.budget > 0) {
      totalBudget += r.budget;
      totalSpent += r.spent;
    }
  }
  return {
    rows,
    totalBudget,
    totalSpent,
    totalPct: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0,
    over: totalBudget > 0 && totalSpent > totalBudget,
  };
};

/** 何のルールも発火しない穏当なベース入力（必要分だけ override する）。 */
const baseInput = (over: Partial<AdviceInput> = {}): AdviceInput => ({
  income: 300000,
  expense: 200000,
  prevIncome: 300000,
  prevExpense: 200000,
  expenseTrend: [200000, 200000, 200000, 200000, 200000, 200000],
  categories: [
    slice("c1", "食費", 80000),
    slice("c2", "日用品", 60000),
    slice("c3", "趣味", 60000),
  ],
  fixedCategoryIds: [],
  categoryTrends: [],
  budget: budgetSummary([]),
  ...over,
});

const trend6 = (
  categoryId: string,
  name: string,
  amounts: number[],
): AdviceInput["categoryTrends"][number] => ({ categoryId, name, amounts });

const ids = (input: AdviceInput) => buildAdvice(input).map((a) => a.id);
const idsOf = (advice: ReturnType<typeof buildAdvice>) =>
  advice.map((a) => a.id);

describe("buildAdvice — 貯蓄率・収支バランス", () => {
  it("支出が収入を上回ると赤字 alert", () => {
    const advice = buildAdvice(baseInput({ income: 100000, expense: 150000 }));
    const a = advice.find((x) => x.id === "deficit");
    expect(a?.severity).toBe("alert");
    expect(a?.title).toContain("¥50,000");
  });

  it("貯蓄率が10%未満で warn", () => {
    const advice = buildAdvice(
      baseInput({
        income: 100000,
        expense: 95000,
        prevExpense: 95000,
        categories: [slice("c1", "食費", 40000), slice("c2", "趣味", 55000)],
      }),
    );
    const a = advice.find((x) => x.id === "low-savings");
    expect(a?.severity).toBe("warn");
  });

  it("貯蓄率が20%以上で good", () => {
    const a = buildAdvice(baseInput()).find((x) => x.id === "good-savings");
    expect(a?.severity).toBe("good");
  });

  it("貯蓄率が前期より改善で good(improved-savings)", () => {
    const advice = buildAdvice(
      baseInput({ prevIncome: 300000, prevExpense: 280000 }),
    );
    expect(idsOf(advice)).toContain("improved-savings");
  });
});

describe("buildAdvice — 予算超過", () => {
  it("予算超過カテゴリは alert", () => {
    const advice = buildAdvice(
      baseInput({ budget: budgetSummary([budgetRow("c1", "食費", 40000, 52000)]) }),
    );
    const a = advice.find((x) => x.severity === "alert");
    expect(a?.title).toContain("食費");
    expect(a?.title).toContain("¥12,000");
  });

  it("予算超過カテゴリは超過額降順で最大2件", () => {
    const advice = buildAdvice(
      baseInput({
        budget: budgetSummary([
          budgetRow("c1", "食費", 40000, 45000), // +5000
          budgetRow("c2", "日用品", 10000, 30000), // +20000
          budgetRow("c3", "趣味", 10000, 22000), // +12000
        ]),
      }),
    );
    const overTitles = advice
      .filter((x) => x.id.startsWith("budget-over:"))
      .map((x) => x.title);
    expect(overTitles).toHaveLength(2);
    expect(overTitles[0]).toContain("日用品"); // 最大超過
    expect(overTitles[1]).toContain("趣味");
  });

  it("予算設定済みで超過0件なら good(budget-within)", () => {
    const advice = buildAdvice(
      baseInput({ budget: budgetSummary([budgetRow("c1", "食費", 40000, 30000)]) }),
    );
    expect(idsOf(advice)).toContain("budget-within");
  });

  it("予算未設定なら予算系アドバイスは出ない", () => {
    const advice = buildAdvice(baseInput());
    expect(idsOf(advice).some((id) => id.startsWith("budget"))).toBe(false);
  });
});

describe("buildAdvice — カテゴリ集中度（固定費除外）", () => {
  it("最多カテゴリが支出の50%以上で info", () => {
    const advice = buildAdvice(
      baseInput({
        expense: 200000,
        categories: [slice("c1", "食費", 120000), slice("c2", "趣味", 80000)],
      }),
    );
    const a = advice.find((x) => x.id === "category-concentration");
    expect(a?.severity).toBe("info");
    expect(a?.title).toContain("食費");
    expect(a?.title).toContain("60%");
  });

  it("偏りが50%未満なら出ない", () => {
    expect(ids(baseInput())).not.toContain("category-concentration");
  });

  it("固定費カテゴリは集中度の母数から除外する", () => {
    // 家賃(c1)が最多だが固定費 → 除外。残る変動費（食費/趣味）で判定する。
    const advice = buildAdvice(
      baseInput({
        expense: 200000,
        categories: [
          slice("c1", "家賃", 120000),
          slice("c2", "食費", 50000),
          slice("c3", "趣味", 30000),
        ],
        fixedCategoryIds: ["c1"],
      }),
    );
    const a = advice.find((x) => x.id === "category-concentration");
    expect(a?.title).toContain("食費"); // 家賃ではなく変動費トップ
    expect(a?.title).not.toContain("家賃");
    expect(a?.title).toContain("63%"); // 50000 / (50000+30000)
  });

  it("固定費を除くと変動費が1カテゴリだけなら出ない（100%集中を抑制）", () => {
    const advice = buildAdvice(
      baseInput({
        expense: 200000,
        categories: [slice("c1", "家賃", 150000), slice("c2", "食費", 50000)],
        fixedCategoryIds: ["c1"],
      }),
    );
    expect(idsOf(advice)).not.toContain("category-concentration");
  });
});

describe("buildAdvice — 支出トレンド", () => {
  it("前期比+20%超で warn(expense-up)", () => {
    const advice = buildAdvice(
      baseInput({ income: 400000, expense: 260000, prevExpense: 200000 }),
    );
    const a = advice.find((x) => x.id === "expense-up");
    expect(a?.severity).toBe("warn");
    expect(a?.title).toContain("30%");
  });

  it("前期比-10%超で good(expense-down)", () => {
    const advice = buildAdvice(
      baseInput({ expense: 170000, prevExpense: 200000 }),
    );
    const a = advice.find((x) => x.id === "expense-down");
    expect(a?.severity).toBe("good");
  });

  it("3期連続増加で warn(expense-up-3)", () => {
    const advice = buildAdvice(
      baseInput({
        expense: 200000,
        prevExpense: 190000,
        expenseTrend: [150000, 160000, 170000, 180000, 190000, 200000],
      }),
    );
    expect(idsOf(advice)).toContain("expense-up-3");
  });
});

describe("buildAdvice — カテゴリ別スパイク（いつもより増えた支出）", () => {
  it("直近平均を大きく上回ったカテゴリを warn で指摘", () => {
    const advice = buildAdvice(
      baseInput({
        categoryTrends: [
          trend6("c2", "外食費", [10000, 12000, 11000, 9000, 10000, 30000]),
        ],
      }),
    );
    const a = advice.find((x) => x.id === "category-spike:c2");
    expect(a?.severity).toBe("warn");
    expect(a?.title).toContain("外食費");
  });

  it("毎月ほぼ一定のカテゴリ（家賃など）は発火しない", () => {
    const advice = buildAdvice(
      baseInput({
        categoryTrends: [
          trend6("c1", "家賃", [80000, 80000, 80000, 80000, 80000, 80000]),
        ],
      }),
    );
    expect(idsOf(advice).some((id) => id.startsWith("category-spike"))).toBe(
      false,
    );
  });

  it("過去実績が無い新規カテゴリは発火しない（baseline 0）", () => {
    const advice = buildAdvice(
      baseInput({
        categoryTrends: [trend6("c3", "家電", [0, 0, 0, 0, 0, 50000])],
      }),
    );
    expect(idsOf(advice).some((id) => id.startsWith("category-spike"))).toBe(
      false,
    );
  });

  it("増加額が小さい（ノイズ）カテゴリは発火しない", () => {
    const advice = buildAdvice(
      baseInput({
        categoryTrends: [trend6("c4", "雑費", [1000, 1000, 1000, 1000, 1000, 2500])],
      }),
    );
    expect(idsOf(advice).some((id) => id.startsWith("category-spike"))).toBe(
      false,
    );
  });

  it("スパイクは増加額の大きい順に最大2件", () => {
    const advice = buildAdvice(
      baseInput({
        categoryTrends: [
          trend6("c1", "外食費", [10000, 10000, 10000, 10000, 10000, 25000]), // +15000
          trend6("c2", "趣味", [5000, 5000, 5000, 5000, 5000, 40000]), // +35000
          trend6("c3", "日用品", [8000, 8000, 8000, 8000, 8000, 20000]), // +12000
        ],
      }),
    );
    const spikes = advice.filter((x) => x.id.startsWith("category-spike:"));
    expect(spikes).toHaveLength(2);
    expect(spikes[0].title).toContain("趣味"); // 最大増加
    expect(spikes[1].title).toContain("外食費");
  });
});

describe("buildAdvice — 並び順・件数・データ不足", () => {
  it("severity 優先で並ぶ（alert→warn→good→info）", () => {
    const advice = buildAdvice(
      baseInput({
        income: 100000,
        expense: 150000, // 赤字 alert
        prevExpense: 100000, // 前期比+50% warn
        categories: [slice("c1", "食費", 100000), slice("c2", "趣味", 50000)], // 集中 info
        budget: budgetSummary([budgetRow("c1", "食費", 40000, 100000)]), // 超過 alert
      }),
    );
    const rank = { alert: 0, warn: 1, good: 2, info: 3 } as const;
    const ranks = advice.map((a) => rank[a.severity]);
    expect(ranks).toEqual([...ranks].sort((x, y) => x - y));
  });

  it("最大5件に絞る", () => {
    const advice = buildAdvice(
      baseInput({
        income: 100000,
        expense: 180000,
        prevExpense: 100000,
        categories: [slice("c1", "食費", 130000), slice("c2", "趣味", 50000)],
        expenseTrend: [120000, 130000, 140000, 150000, 160000, 180000],
        budget: budgetSummary([
          budgetRow("c1", "食費", 40000, 120000),
          budgetRow("c2", "趣味", 10000, 50000),
        ]),
      }),
    );
    expect(advice.length).toBeLessThanOrEqual(5);
  });

  it("データが無いときは info を1件だけ返す", () => {
    const advice = buildAdvice(
      baseInput({
        income: 0,
        expense: 0,
        prevIncome: 0,
        prevExpense: 0,
        expenseTrend: [0, 0, 0, 0, 0, 0],
        categories: [],
        budget: budgetSummary([]),
      }),
    );
    expect(advice).toHaveLength(1);
    expect(advice[0].severity).toBe("info");
    expect(advice[0].id).toBe("no-data");
  });
});
