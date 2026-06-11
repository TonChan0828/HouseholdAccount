import { describe, expect, it } from "vitest";

import {
  buildCategoryMemberMatrix,
  type MatrixTx,
} from "./category-matrix";
import type { MemberInfo } from "./members";

const tx = (over: Partial<MatrixTx>): MatrixTx => ({
  amount: 0,
  type: "expense",
  created_by: "user-1",
  category_id: "cat-food",
  category: { name: "食費", color: "#f97316" },
  ...over,
});

const members: MemberInfo[] = [
  { user_id: "user-1", display_name: "太郎" },
  { user_id: "user-2", display_name: "花子" },
];

describe("buildCategoryMemberMatrix", () => {
  it("支出・収入をセクション別にカテゴリ行×メンバーセルへ集計する", () => {
    const txs = [
      tx({ created_by: "user-1", amount: 40000 }),
      tx({ created_by: "user-2", amount: 30000 }),
      tx({
        created_by: "user-1",
        type: "income",
        amount: 320000,
        category_id: "cat-salary",
        category: { name: "給与", color: "#22c55e" },
      }),
    ];

    const result = buildCategoryMemberMatrix(txs, members);

    expect(result.members).toEqual([
      { userId: "user-1", displayName: "太郎" },
      { userId: "user-2", displayName: "花子" },
    ]);
    expect(result.expense.rows).toEqual([
      {
        categoryId: "cat-food",
        name: "食費",
        color: "#f97316",
        cells: [40000, 30000],
        total: 70000,
      },
    ]);
    expect(result.income.rows).toEqual([
      {
        categoryId: "cat-salary",
        name: "給与",
        color: "#22c55e",
        cells: [320000, 0],
        total: 320000,
      },
    ]);
  });

  it("合計行・合計列・セクション総計が一致する", () => {
    const txs = [
      tx({ created_by: "user-1", amount: 1000 }),
      tx({ created_by: "user-2", amount: 2000 }),
      tx({
        created_by: "user-2",
        amount: 500,
        category_id: "cat-transport",
        category: { name: "交通費", color: "#3b82f6" },
      }),
    ];

    const result = buildCategoryMemberMatrix(txs, members);

    expect(result.expense.memberTotals).toEqual([1000, 2500]);
    expect(result.expense.total).toBe(3500);
    expect(
      result.expense.rows.reduce((s, r) => s + r.total, 0),
    ).toBe(3500);
  });

  it("members の並び順を列順として維持し、取引ゼロのメンバーはセル0になる", () => {
    const reversed = [...members].reverse();
    const txs = [tx({ created_by: "user-1", amount: 100 })];

    const result = buildCategoryMemberMatrix(txs, reversed);

    expect(result.members.map((m) => m.userId)).toEqual([
      "user-2",
      "user-1",
    ]);
    expect(result.expense.rows[0].cells).toEqual([0, 100]);
    expect(result.expense.memberTotals).toEqual([0, 100]);
  });

  it("取引のあるカテゴリのみ行になり、行は合計の降順で並ぶ", () => {
    const txs = [
      tx({ amount: 100 }),
      tx({
        amount: 900,
        category_id: "cat-transport",
        category: { name: "交通費", color: "#3b82f6" },
      }),
    ];

    const result = buildCategoryMemberMatrix(txs, members);

    expect(result.expense.rows.map((r) => r.name)).toEqual([
      "交通費",
      "食費",
    ]);
  });

  it("category_id が null の取引は「未分類」行へ集約する", () => {
    const txs = [
      tx({ amount: 300, category_id: null, category: null }),
      tx({ created_by: "user-2", amount: 200, category_id: null, category: null }),
    ];

    const result = buildCategoryMemberMatrix(txs, members);

    expect(result.expense.rows).toEqual([
      {
        categoryId: null,
        name: "未分類",
        color: "#999",
        cells: [300, 200],
        total: 500,
      },
    ]);
  });

  it("同一カテゴリが収入・支出の両方で使われた場合は両セクションに現れる", () => {
    const txs = [
      tx({
        amount: 1000,
        category_id: "cat-misc",
        category: { name: "その他", color: "#a855f7" },
      }),
      tx({
        type: "income",
        amount: 5000,
        category_id: "cat-misc",
        category: { name: "その他", color: "#a855f7" },
      }),
    ];

    const result = buildCategoryMemberMatrix(txs, members);

    expect(result.expense.rows[0]).toMatchObject({
      categoryId: "cat-misc",
      total: 1000,
    });
    expect(result.income.rows[0]).toMatchObject({
      categoryId: "cat-misc",
      total: 5000,
    });
  });

  it("メンバー一覧にいないユーザーの取引は無視する（脱退者など）", () => {
    const txs = [
      tx({ created_by: "user-gone", amount: 999 }),
      tx({ created_by: "user-1", amount: 100 }),
    ];

    const result = buildCategoryMemberMatrix(txs, members);

    expect(result.expense.rows[0].cells).toEqual([100, 0]);
    expect(result.expense.total).toBe(100);
  });

  it("取引0件なら空の行と全0の合計行を返す", () => {
    const result = buildCategoryMemberMatrix([], members);

    expect(result.expense).toEqual({
      rows: [],
      memberTotals: [0, 0],
      total: 0,
    });
    expect(result.income).toEqual({
      rows: [],
      memberTotals: [0, 0],
      total: 0,
    });
  });
});
