import { describe, expect, it } from "vitest";

import {
  addCategory,
  addTransaction,
  createDemoState,
  editCategory,
  editTransaction,
  removeCategory,
  removeTransaction,
  selectTransactionRows,
} from "./store";

describe("createDemoState", () => {
  it("サンプルデータ（メンバー4名・カテゴリ・収支）を持つ", () => {
    const s = createDemoState();
    expect(s.members).toHaveLength(4);
    expect(s.categories.length).toBeGreaterThan(0);
    expect(s.transactions.length).toBeGreaterThan(0);
    expect(s.household.period_start_day).toBe(1);
  });

  it("デフォルトカテゴリとカスタムカテゴリが混在する", () => {
    const s = createDemoState();
    expect(s.categories.some((c) => c.is_default)).toBe(true);
    expect(s.categories.some((c) => !c.is_default)).toBe(true);
  });

  it("カテゴリIDは uuid 形式（収支フォームのZod検証を通すため）", () => {
    const s = createDemoState();
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const c of s.categories) {
      expect(c.id).toMatch(uuid);
    }
  });

  it("ID は決定論的（SSR とクライアントで一致しハイドレーション不一致を防ぐ）", () => {
    const a = createDemoState();
    const b = createDemoState();
    expect(a.categories.map((c) => c.id)).toEqual(b.categories.map((c) => c.id));
    expect(a.transactions.map((t) => t.id)).toEqual(
      b.transactions.map((t) => t.id),
    );
  });
});

describe("addTransaction", () => {
  it("収支が1件増え、入力値が反映される", () => {
    const s = createDemoState();
    const before = s.transactions.length;
    const next = addTransaction(s, {
      type: "expense",
      amount: 1234,
      date: "2026-06-10",
      category_id: undefined,
      memo: "テスト",
    });
    expect(next.transactions).toHaveLength(before + 1);
    const added = next.transactions.find((t) => t.amount === 1234);
    expect(added).toBeDefined();
    expect(added?.memo).toBe("テスト");
    expect(added?.created_by).toBe(s.currentUserId);
  });

  it("元の状態を破壊しない（イミュータブル）", () => {
    const s = createDemoState();
    const before = s.transactions.length;
    addTransaction(s, { type: "income", amount: 500, date: "2026-06-01" });
    expect(s.transactions).toHaveLength(before);
  });
});

describe("editTransaction", () => {
  it("指定IDの金額を更新する", () => {
    const s = createDemoState();
    const target = s.transactions[0];
    const next = editTransaction(s, target.id, {
      type: target.type,
      amount: 99999,
      date: target.date,
      category_id: target.category_id ?? undefined,
    });
    expect(next.transactions.find((t) => t.id === target.id)?.amount).toBe(
      99999,
    );
  });
});

describe("removeTransaction", () => {
  it("指定IDを削除する", () => {
    const s = createDemoState();
    const target = s.transactions[0];
    const next = removeTransaction(s, target.id);
    expect(next.transactions.some((t) => t.id === target.id)).toBe(false);
    expect(next.transactions).toHaveLength(s.transactions.length - 1);
  });
});

describe("addCategory", () => {
  it("is_default=false のカスタムカテゴリを追加する", () => {
    const s = createDemoState();
    const next = addCategory(s, {
      name: "ペット",
      color: "#ef4444",
      type: "expense",
    });
    const added = next.categories.find((c) => c.name === "ペット");
    expect(added).toBeDefined();
    expect(added?.is_default).toBe(false);
  });
});

describe("editCategory", () => {
  it("カスタムカテゴリ名を更新する", () => {
    const s = createDemoState();
    const custom = s.categories.find((c) => !c.is_default)!;
    const next = editCategory(s, custom.id, {
      name: "更新後",
      color: "#ef4444",
      type: custom.type,
    });
    expect(next.categories.find((c) => c.id === custom.id)?.name).toBe("更新後");
  });

  it("デフォルトカテゴリの編集は no-op", () => {
    const s = createDemoState();
    const def = s.categories.find((c) => c.is_default)!;
    const next = editCategory(s, def.id, {
      name: "書き換え",
      color: "#ef4444",
      type: "expense",
    });
    expect(next.categories.find((c) => c.id === def.id)?.name).toBe(def.name);
  });
});

describe("removeCategory", () => {
  it("カスタムカテゴリを削除し、参照していた収支は未分類になる", () => {
    let s = createDemoState();
    const custom = s.categories.find((c) => !c.is_default)!;
    // このカテゴリを参照する収支を1件作る
    s = addTransaction(s, {
      type: "expense",
      amount: 300,
      date: "2026-06-05",
      category_id: custom.id,
    });
    const next = removeCategory(s, custom.id);
    expect(next.categories.some((c) => c.id === custom.id)).toBe(false);
    expect(
      next.transactions.some((t) => t.category_id === custom.id),
    ).toBe(false);
  });

  it("デフォルトカテゴリの削除は no-op", () => {
    const s = createDemoState();
    const def = s.categories.find((c) => c.is_default)!;
    const next = removeCategory(s, def.id);
    expect(next.categories.some((c) => c.id === def.id)).toBe(true);
  });
});

describe("selectTransactionRows", () => {
  it("カテゴリ名・色を join し、未選択は null になる", () => {
    let s = createDemoState();
    const cat = s.categories[0];
    s = addTransaction(s, {
      type: cat.type === "income" ? "income" : "expense",
      amount: 700,
      date: "2026-06-07",
      category_id: cat.id,
    });
    s = addTransaction(s, {
      type: "expense",
      amount: 800,
      date: "2026-06-08",
      category_id: undefined,
    });
    const rows = selectTransactionRows(s);
    const withCat = rows.find((r) => r.amount === 700);
    const without = rows.find((r) => r.amount === 800);
    expect(withCat?.category?.name).toBe(cat.name);
    expect(without?.category).toBeNull();
  });
});
