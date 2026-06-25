import { describe, expect, it } from "vitest";

import { recurringTransactionSchema, transactionSchema } from "./transaction";

const valid = {
  type: "expense",
  amount: "1200",
  date: "2026-06-08",
  category_id: "",
  memo: "ランチ",
};

describe("transactionSchema", () => {
  it("正しい支出入力を受け付け、amount を数値に変換する", () => {
    const result = transactionSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(1200);
      expect(result.data.type).toBe("expense");
    }
  });

  it("収入も受け付ける", () => {
    expect(
      transactionSchema.safeParse({ ...valid, type: "income" }).success,
    ).toBe(true);
  });

  it("不正な type を拒否する", () => {
    expect(
      transactionSchema.safeParse({ ...valid, type: "transfer" }).success,
    ).toBe(false);
  });

  it("0円・マイナスを拒否する", () => {
    expect(transactionSchema.safeParse({ ...valid, amount: "0" }).success).toBe(
      false,
    );
    expect(
      transactionSchema.safeParse({ ...valid, amount: "-100" }).success,
    ).toBe(false);
  });

  it("小数は四捨五入して整数に変換する", () => {
    const result = transactionSchema.safeParse({ ...valid, amount: "10.5" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(11);
    }
  });

  it("四則演算式を評価して金額に変換する", () => {
    const result = transactionSchema.safeParse({ ...valid, amount: "1280+980+550" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(2810);
    }
  });

  it("割り算の結果を四捨五入して受け付ける", () => {
    const result = transactionSchema.safeParse({ ...valid, amount: "1000÷3" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(333);
    }
  });

  it("評価できない式を拒否する", () => {
    expect(
      transactionSchema.safeParse({ ...valid, amount: "1000+" }).success,
    ).toBe(false);
    expect(
      transactionSchema.safeParse({ ...valid, amount: "abc" }).success,
    ).toBe(false);
  });

  it("不正な日付形式を拒否する", () => {
    expect(
      transactionSchema.safeParse({ ...valid, date: "2026/06/08" }).success,
    ).toBe(false);
  });

  it("カテゴリ未選択（空文字）を許可し undefined に正規化する", () => {
    const result = transactionSchema.safeParse({ ...valid, category_id: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category_id).toBeUndefined();
    }
  });

  it("200字を超えるメモを拒否する", () => {
    expect(
      transactionSchema.safeParse({ ...valid, memo: "あ".repeat(201) }).success,
    ).toBe(false);
  });
});

const validRecurring = {
  type: "expense",
  amount: "9800",
  category_id: "",
  memo: "サブスク",
  is_active: "true",
};

describe("recurringTransactionSchema", () => {
  it("日付なしの定期項目を受け付け、amount を数値に変換する", () => {
    const result = recurringTransactionSchema.safeParse(validRecurring);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(9800);
      expect(result.data.is_active).toBe(true);
      expect("date" in result.data).toBe(false);
    }
  });

  it("四則演算式を評価する（収支スキーマと同じ挙動）", () => {
    const result = recurringTransactionSchema.safeParse({
      ...validRecurring,
      amount: "5000+480",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(5480);
    }
  });

  it("is_active を真偽値へ正規化する", () => {
    const off = recurringTransactionSchema.safeParse({
      ...validRecurring,
      is_active: "false",
    });
    expect(off.success && off.data.is_active).toBe(false);

    const on = recurringTransactionSchema.safeParse({
      ...validRecurring,
      is_active: "on",
    });
    expect(on.success && on.data.is_active).toBe(true);
  });

  it("is_active 未指定は既定で有効にする", () => {
    const result = recurringTransactionSchema.safeParse({
      type: "expense",
      amount: "9800",
      category_id: "",
      memo: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_active).toBe(true);
    }
  });

  it("0円・マイナスを拒否する", () => {
    expect(
      recurringTransactionSchema.safeParse({ ...validRecurring, amount: "0" })
        .success,
    ).toBe(false);
  });
});
