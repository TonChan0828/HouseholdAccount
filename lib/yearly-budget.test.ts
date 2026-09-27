import { describe, expect, it } from "vitest";

import { buildYearlyBudget } from "./yearly-budget";

const categories = [
  { id: "food", name: "食費", color: "#f00" },
  { id: "daily", name: "日用品", color: null },
  { id: "hobby", name: "趣味", color: "#00f" },
];

const slice = (categoryId: string | null, amount: number) => ({
  categoryId,
  amount,
});

describe("buildYearlyBudget", () => {
  it("明示された年間予算と年間実績をカテゴリ別に照合する", () => {
    const result = buildYearlyBudget(
      [
        { category_id: "food", amount: 480_000 },
        { category_id: "hobby", amount: 60_000 },
      ],
      [slice("food", 500_000), slice("hobby", 30_000)],
      categories,
    );

    expect(result.rows).toEqual([
      expect.objectContaining({
        categoryId: "food",
        annualBudget: 480_000,
        actual: 500_000,
        pct: 104,
        over: true,
      }),
      expect.objectContaining({
        categoryId: "daily",
        annualBudget: 0,
        actual: 0,
        pct: 0,
        over: false,
        color: "#999",
      }),
      expect.objectContaining({
        categoryId: "hobby",
        annualBudget: 60_000,
        actual: 30_000,
        pct: 50,
        over: false,
      }),
    ]);
    expect(result).toMatchObject({
      totalBudget: 540_000,
      totalActual: 530_000,
      totalPct: 98,
      over: false,
    });
  });

  it("合計実績は年間予算が設定されたカテゴリだけを含む", () => {
    const result = buildYearlyBudget(
      [{ category_id: "food", amount: 100_000 }],
      [slice("food", 80_000), slice("daily", 70_000)],
      categories,
    );

    expect(result.totalBudget).toBe(100_000);
    expect(result.totalActual).toBe(80_000);
    expect(result.rows[1]).toMatchObject({ actual: 70_000, annualBudget: 0 });
  });

  it("予算超過をカテゴリ・合計の両方で判定し、未分類の支出は除く", () => {
    const result = buildYearlyBudget(
      [{ category_id: "food", amount: 100_000 }],
      [slice("food", 125_000), slice(null, 90_000)],
      categories,
    );

    expect(result.rows[0]).toMatchObject({ pct: 125, over: true });
    expect(result).toMatchObject({ totalActual: 125_000, totalPct: 125, over: true });
  });

  it("年間予算未設定なら進捗を0にし、設定済みでも実績なしなら未超過", () => {
    const empty = buildYearlyBudget([], [slice("food", 4_000)], categories);
    expect(empty).toMatchObject({
      totalBudget: 0,
      totalActual: 0,
      totalPct: 0,
      over: false,
    });

    const noActual = buildYearlyBudget(
      [{ category_id: "hobby", amount: 12_000 }],
      [],
      categories,
    );
    expect(noActual.rows[2]).toMatchObject({ annualBudget: 12_000, actual: 0, pct: 0, over: false });
  });
});
