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

  it.each(["2025-02-29", "2026-04-31", "0000-01-01"])("存在しない日付を拒否する: %s", (date) => {
    expect(transactionSchema.safeParse({ ...valid, date }).success).toBe(false);
  });

  it("うるう日を受け付ける", () => {
    expect(transactionSchema.safeParse({ ...valid, date: "2024-02-29" }).success).toBe(true);
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

  describe("is_shared（精算対象フラグ）", () => {
    it("チェックボックスの 'on' / 'true' は true になる", () => {
      expect(
        transactionSchema.parse({ ...valid, is_shared: "on" }).is_shared,
      ).toBe(true);
      expect(
        transactionSchema.parse({ ...valid, is_shared: "true" }).is_shared,
      ).toBe(true);
    });

    it("未指定（null）・'false' は false になる", () => {
      expect(
        transactionSchema.parse({ ...valid, is_shared: null }).is_shared,
      ).toBe(false);
      expect(
        transactionSchema.parse({ ...valid, is_shared: "false" }).is_shared,
      ).toBe(false);
    });

    it("recurringTransactionSchema にも引き継がれる", () => {
      const parsed = recurringTransactionSchema.parse({
        ...validRecurring,
        is_shared: "on",
      });
      expect(parsed.is_shared).toBe(true);
    });
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

describe("on_behalf_of（名義人・spec 41）", () => {
  const UUID = "22222222-2222-4222-8222-222222222222";

  it("UUID を受け付ける", () => {
    const result = transactionSchema.safeParse({ ...valid, on_behalf_of: UUID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.on_behalf_of).toBe(UUID);
    }
  });

  it("未指定・空文字は undefined にする", () => {
    expect(transactionSchema.parse(valid).on_behalf_of).toBeUndefined();
    expect(
      transactionSchema.parse({ ...valid, on_behalf_of: "" }).on_behalf_of,
    ).toBeUndefined();
  });

  it("UUID でない値を拒否する", () => {
    const result = transactionSchema.safeParse({
      ...valid,
      on_behalf_of: "not-a-uuid",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("名義人が不正です");
    }
  });

  it("recurringTransactionSchema には引き継がれない（定期収支は対象外）", () => {
    const parsed = recurringTransactionSchema.parse({
      ...validRecurring,
      on_behalf_of: UUID,
    });
    expect("on_behalf_of" in parsed).toBe(false);
  });
});
