import { describe, expect, it } from "vitest";

import { buildBudgetRows } from "./budget";
import type { CategorySlice } from "./analytics";

const cats = [
  { id: "c1", name: "食費", color: "#f00" },
  { id: "c2", name: "日用品", color: "#0f0" },
  { id: "c3", name: "趣味", color: "#00f" },
];

const slice = (
  categoryId: string,
  name: string,
  amount: number,
): CategorySlice => ({ categoryId, name, color: "#abc", amount });

describe("buildBudgetRows", () => {
  it("カテゴリごとに予算と実績をマージした行を返す", () => {
    const { rows } = buildBudgetRows(
      [{ category_id: "c1", amount: 40000 }],
      [slice("c1", "食費", 32000)],
      cats,
    );
    const food = rows.find((r) => r.categoryId === "c1");
    expect(food).toMatchObject({ budget: 40000, spent: 32000, pct: 80, over: false });
  });

  it("予算ありで実績が無いカテゴリは spent 0・pct 0", () => {
    const { rows } = buildBudgetRows(
      [{ category_id: "c3", amount: 20000 }],
      [],
      cats,
    );
    const hobby = rows.find((r) => r.categoryId === "c3");
    expect(hobby).toMatchObject({ budget: 20000, spent: 0, pct: 0, over: false });
  });

  it("予算未設定カテゴリは budget 0・pct 0・over false", () => {
    const { rows } = buildBudgetRows([], [slice("c2", "日用品", 5000)], cats);
    const daily = rows.find((r) => r.categoryId === "c2");
    expect(daily).toMatchObject({ budget: 0, spent: 5000, pct: 0, over: false });
  });

  it("実績が予算を超えると over=true、pct は四捨五入", () => {
    const { rows } = buildBudgetRows(
      [{ category_id: "c2", amount: 10000 }],
      [slice("c2", "日用品", 12500)],
      cats,
    );
    const daily = rows.find((r) => r.categoryId === "c2");
    expect(daily).toMatchObject({ budget: 10000, spent: 12500, pct: 125, over: true });
  });

  it("行はカテゴリ一覧の順序を保つ", () => {
    const { rows } = buildBudgetRows([], [], cats);
    expect(rows.map((r) => r.categoryId)).toEqual(["c1", "c2", "c3"]);
  });

  it("行の name/color はカテゴリ一覧から取る", () => {
    const { rows } = buildBudgetRows([], [], cats);
    expect(rows[0]).toMatchObject({ name: "食費", color: "#f00" });
  });

  it("合計は予算設定済みカテゴリのみを対象に集計する", () => {
    const { totalBudget, totalSpent, totalPct, over } = buildBudgetRows(
      [
        { category_id: "c1", amount: 40000 },
        { category_id: "c3", amount: 20000 },
      ],
      [
        slice("c1", "食費", 32000),
        slice("c2", "日用品", 5000), // 予算未設定 → 合計に含めない
        slice("c3", "趣味", 6000),
      ],
      cats,
    );
    expect(totalBudget).toBe(60000);
    expect(totalSpent).toBe(38000); // 32000 + 6000（c2 の 5000 は除外）
    expect(totalPct).toBe(63); // round(38000/60000*100)
    expect(over).toBe(false);
  });

  it("合計実績が合計予算を超えると over=true", () => {
    const { over, totalPct } = buildBudgetRows(
      [{ category_id: "c1", amount: 10000 }],
      [slice("c1", "食費", 15000)],
      cats,
    );
    expect(over).toBe(true);
    expect(totalPct).toBe(150);
  });

  it("予算が一つも無いとき合計は0・over false", () => {
    const { totalBudget, totalSpent, totalPct, over } = buildBudgetRows(
      [],
      [slice("c1", "食費", 9999)],
      cats,
    );
    expect(totalBudget).toBe(0);
    expect(totalSpent).toBe(0);
    expect(totalPct).toBe(0);
    expect(over).toBe(false);
  });
});
