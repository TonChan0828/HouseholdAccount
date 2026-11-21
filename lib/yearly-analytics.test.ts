import { describe, expect, it } from "vitest";

import type { CategorySlice, TxLite } from "./analytics";
import { getYearRanges } from "./period";
import {
  compareCategoryYoY,
  countElapsed,
  summarizeYear,
} from "./yearly-analytics";

const tx = (over: Partial<TxLite>): TxLite => ({
  amount: 0,
  type: "expense",
  date: "2026-06-10",
  category_id: null,
  category: null,
  ...over,
});

const slice = (
  categoryId: string | null,
  name: string,
  amount: number,
): CategorySlice => ({ categoryId, name, color: "#abc", amount, count: 1 });

describe("countElapsed", () => {
  const ranges = getYearRanges(2026, 1);

  it("開始日が今日以前の期を数える（期の途中も経過扱い）", () => {
    expect(countElapsed(ranges, "2026-06-15")).toBe(6);
  });

  it("期の開始日当日は経過に含む", () => {
    expect(countElapsed(ranges, "2026-07-01")).toBe(7);
  });

  it("過去年は12、未来年は0", () => {
    expect(countElapsed(ranges, "2027-03-01")).toBe(12);
    expect(countElapsed(ranges, "2025-12-31")).toBe(0);
  });
});

describe("summarizeYear", () => {
  const ranges = getYearRanges(2026, 1);

  it("12期を「1月」〜「12月」ラベルで集計し、年間合計と収支を返す", () => {
    const s = summarizeYear(
      [
        tx({ type: "income", amount: 300000, date: "2026-01-25" }),
        tx({ amount: 100000, date: "2026-01-10" }),
        tx({ amount: 50000, date: "2026-03-31" }),
        // 年外は無視
        tx({ amount: 99999, date: "2025-12-31" }),
        tx({ amount: 99999, date: "2027-01-01" }),
      ],
      ranges,
      "2027-02-01",
    );
    expect(s.months).toHaveLength(12);
    expect(s.months[0]).toEqual({ label: "1月", income: 300000, expense: 100000 });
    expect(s.months[2]).toEqual({ label: "3月", income: 0, expense: 50000 });
    expect(s.months[11].label).toBe("12月");
    expect(s.income).toBe(300000);
    expect(s.expense).toBe(150000);
    expect(s.balance).toBe(150000);
    expect(s.savingsRate).toBe(0.5);
    expect(s.elapsed).toBe(12);
    expect(s.avgExpense).toBe(12500);
    expect(s.peakExpense).toEqual({ label: "1月", amount: 100000 });
  });

  it("締め日25ではラベルは開始月で付き、1/24 以前は前年扱い", () => {
    const s = summarizeYear(
      [
        tx({ amount: 1000, date: "2026-01-24" }),
        tx({ amount: 2000, date: "2026-01-25" }),
        tx({ amount: 3000, date: "2027-01-24" }),
      ],
      getYearRanges(2026, 25),
      "2027-06-01",
    );
    expect(s.months[0]).toEqual({ label: "1月", income: 0, expense: 2000 });
    expect(s.months[11]).toEqual({ label: "12月", income: 0, expense: 3000 });
    expect(s.expense).toBe(5000);
  });

  it("進行中の年は経過期数で月平均を割る（四捨五入）", () => {
    const s = summarizeYear(
      [tx({ amount: 10000, date: "2026-02-10" })],
      ranges,
      "2026-03-05",
    );
    expect(s.elapsed).toBe(3);
    expect(s.avgExpense).toBe(3333);
  });

  it("収入0なら貯蓄率は null、支出0なら支出最多月は null、未来年の平均は0", () => {
    const s = summarizeYear([], ranges, "2025-01-01");
    expect(s.savingsRate).toBeNull();
    expect(s.peakExpense).toBeNull();
    expect(s.elapsed).toBe(0);
    expect(s.avgExpense).toBe(0);
    expect(s.balance).toBe(0);
  });

  it("赤字は負の収支・負の貯蓄率になる", () => {
    const s = summarizeYear(
      [
        tx({ type: "income", amount: 100000 }),
        tx({ amount: 150000 }),
      ],
      ranges,
      "2026-12-31",
    );
    expect(s.balance).toBe(-50000);
    expect(s.savingsRate).toBe(-0.5);
  });
});

describe("compareCategoryYoY", () => {
  it("当年と前年をカテゴリで突き合わせ、差額の絶対値降順で返す", () => {
    const rows = compareCategoryYoY(
      [slice("food", "食費", 60000), slice("fun", "娯楽", 10000)],
      [slice("food", "食費", 50000), slice("fun", "娯楽", 40000)],
    );
    expect(rows.map((r) => r.categoryId)).toEqual(["fun", "food"]);
    expect(rows[0]).toMatchObject({
      name: "娯楽",
      amount: 10000,
      prevAmount: 40000,
      diff: -30000,
      ratio: -0.75,
    });
    expect(rows[1]).toMatchObject({ diff: 10000, ratio: 0.2 });
  });

  it("前年のみ・当年のみのカテゴリも含め、前年0なら ratio は null", () => {
    const rows = compareCategoryYoY(
      [slice("new", "新規", 5000)],
      [slice("old", "旧", 3000)],
    );
    const byId = Object.fromEntries(rows.map((r) => [r.categoryId, r]));
    expect(byId.new).toMatchObject({ amount: 5000, prevAmount: 0, ratio: null });
    expect(byId.old).toMatchObject({
      name: "旧",
      amount: 0,
      prevAmount: 3000,
      diff: -3000,
      ratio: -1,
    });
  });

  it("未分類（categoryId=null）同士も突き合わせ、差額0は除外する", () => {
    const rows = compareCategoryYoY(
      [slice(null, "未分類", 2000), slice("same", "同額", 1000)],
      [slice(null, "未分類", 500), slice("same", "同額", 1000)],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ categoryId: null, diff: 1500 });
  });
});
