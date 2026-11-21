import { describe, expect, it } from "vitest";

import {
  buildBalanceBars,
  summarizeCategoryExpense,
  summarizeCategoryTrend,
  summarizeTrend,
  type TxLite,
} from "./analytics";

const range = (startISO: string, endISO: string) => ({
  start: new Date(`${startISO}T00:00:00Z`),
  end: new Date(`${endISO}T00:00:00Z`),
});

const tx = (over: Partial<TxLite>): TxLite => ({
  amount: 0,
  type: "expense",
  date: "2026-06-10",
  category_id: null,
  category: null,
  ...over,
});

describe("summarizeTrend", () => {
  it("各期の収入・支出を期バケットへ集計する", () => {
    const ranges = [
      range("2026-05-01", "2026-06-01"),
      range("2026-06-01", "2026-07-01"),
    ];
    const txs = [
      tx({ date: "2026-05-10", type: "income", amount: 1000 }),
      tx({ date: "2026-05-20", type: "expense", amount: 300 }),
      tx({ date: "2026-06-05", type: "expense", amount: 500 }),
    ];

    const result = summarizeTrend(txs, ranges);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ income: 1000, expense: 300 });
    expect(result[1]).toMatchObject({ income: 0, expense: 500 });
  });

  it("期の開始日を MM/DD〜 のラベルにする", () => {
    const result = summarizeTrend([], [range("2026-06-01", "2026-07-01")]);
    expect(result[0].label).toBe("06/01〜");
  });

  it("データが無くても各期を0で返す", () => {
    const result = summarizeTrend([], [range("2026-06-01", "2026-07-01")]);
    expect(result[0]).toMatchObject({ income: 0, expense: 0 });
  });

  it("半開区間の境界: start ちょうどは含み、end ちょうどは含まない", () => {
    const ranges = [range("2026-06-01", "2026-07-01")];
    const txs = [
      tx({ date: "2026-06-01", type: "expense", amount: 100 }), // start ちょうど→含む
      tx({ date: "2026-07-01", type: "expense", amount: 200 }), // end ちょうど→含まない
    ];

    const result = summarizeTrend(txs, ranges);

    expect(result[0].expense).toBe(100);
  });
});

describe("buildBalanceBars", () => {
  it("収入・支出の順に2本の棒データを返す", () => {
    const result = buildBalanceBars(1000, 300);

    expect(result).toEqual([
      { label: "収入", amount: 1000, key: "income" },
      { label: "支出", amount: 300, key: "expense" },
    ]);
  });

  it("収入・支出が0でも2本の棒データを返す", () => {
    const result = buildBalanceBars(0, 0);

    expect(result).toHaveLength(2);
    expect(result.map((b) => b.amount)).toEqual([0, 0]);
  });
});

describe("summarizeCategoryExpense", () => {
  it("支出のみをカテゴリ別に集計し金額降順で返す", () => {
    const txs = [
      tx({ type: "expense", amount: 300, category_id: "c1", category: { name: "食費", color: "#f00" } }),
      tx({ type: "expense", amount: 700, category_id: "c2", category: { name: "日用品", color: "#0f0" } }),
      tx({ type: "income", amount: 9999, category_id: "c1", category: { name: "食費", color: "#f00" } }),
    ];

    const result = summarizeCategoryExpense(txs);

    expect(result).toEqual([
      { categoryId: "c2", name: "日用品", color: "#0f0", amount: 700, count: 1 },
      { categoryId: "c1", name: "食費", color: "#f00", amount: 300, count: 1 },
    ]);
  });

  it("カテゴリ未設定は未分類に集約する", () => {
    const txs = [
      tx({ type: "expense", amount: 100, category_id: null, category: null }),
      tx({ type: "expense", amount: 200, category_id: null, category: null }),
    ];

    const result = summarizeCategoryExpense(txs);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      categoryId: null,
      name: "未分類",
      color: "#999",
      amount: 300,
      count: 2,
    });
  });

  it.each([15, 16])("%iカテゴリをすべて返し、相殺された支出も数える", (count) => {
    const rows = Array.from({ length: count }, (_, i) =>
      tx({ category_id: String(i), amount: i + 1 }),
    );
    rows.push(tx({ category_id: "0", amount: -1 }));
    const result = summarizeCategoryExpense(rows);
    expect(result).toHaveLength(count);
    expect(result.at(-1)).toMatchObject({ categoryId: "0", amount: 0, count: 2 });
  });

  it("支出が無ければ空配列を返す", () => {
    expect(summarizeCategoryExpense([tx({ type: "income", amount: 500 })])).toEqual([]);
  });
});

describe("summarizeCategoryTrend", () => {
  const ranges = [
    range("2026-05-01", "2026-06-01"),
    range("2026-06-01", "2026-07-01"),
  ];

  it("カテゴリごとに各期の支出を ranges の並びで集計する", () => {
    const txs = [
      tx({ date: "2026-05-10", amount: 300, category_id: "c1", category: { name: "食費", color: "#f00" } }),
      tx({ date: "2026-06-05", amount: 500, category_id: "c1", category: { name: "食費", color: "#f00" } }),
      tx({ date: "2026-06-20", amount: 200, category_id: "c1", category: { name: "食費", color: "#f00" } }),
    ];

    const result = summarizeCategoryTrend(txs, ranges);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ categoryId: "c1", name: "食費" });
    expect(result[0].amounts).toEqual([300, 700]);
  });

  it("収入や期外の取引は無視する", () => {
    const txs = [
      tx({ date: "2026-06-05", type: "income", amount: 9999, category_id: "c1", category: { name: "食費", color: "#f00" } }),
      tx({ date: "2026-04-05", amount: 100, category_id: "c1", category: { name: "食費", color: "#f00" } }),
    ];

    expect(summarizeCategoryTrend(txs, ranges)).toEqual([]);
  });

  it("半開区間の境界: start ちょうどは含み、end ちょうどは含まない", () => {
    const txs = [
      tx({ date: "2026-06-01", amount: 100, category_id: "c1", category: { name: "食費", color: "#f00" } }), // start ちょうど→含む
      tx({ date: "2026-07-01", amount: 200, category_id: "c1", category: { name: "食費", color: "#f00" } }), // end ちょうど→含まない
    ];

    const result = summarizeCategoryTrend(txs, ranges);

    expect(result[0].amounts).toEqual([0, 100]);
  });

  it("複数カテゴリはそれぞれ別の行に集計する（同一キーへの誤集約を検出）", () => {
    const txs = [
      tx({ date: "2026-06-05", amount: 300, category_id: "c1", category: { name: "食費", color: "#f00" } }),
      tx({ date: "2026-06-05", amount: 700, category_id: "c2", category: { name: "交通費", color: "#0f0" } }),
    ];

    const result = summarizeCategoryTrend(txs, ranges);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.name).sort()).toEqual(["交通費", "食費"]);
  });

  it("category が null でもクラッシュせず未分類にフォールバックする", () => {
    const txs = [
      tx({ date: "2026-06-05", amount: 300, category_id: "c1", category: null }),
    ];

    const result = summarizeCategoryTrend(txs, ranges);

    expect(result[0]).toMatchObject({ categoryId: "c1", name: "未分類" });
  });
});
