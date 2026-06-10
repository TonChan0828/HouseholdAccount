import { describe, expect, it } from "vitest";

import { CATEGORY_COLORS, categorySchema } from "./category";

const valid = {
  name: "ペット",
  color: CATEGORY_COLORS[0],
  type: "expense",
};

describe("categorySchema", () => {
  it("正しい入力を受け付ける", () => {
    const result = categorySchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("名前が空ならエラーになる", () => {
    const result = categorySchema.safeParse({ ...valid, name: "" });
    expect(result.success).toBe(false);
  });

  it("名前が51文字以上ならエラーになる", () => {
    const result = categorySchema.safeParse({ ...valid, name: "あ".repeat(51) });
    expect(result.success).toBe(false);
  });

  it("名前が50文字ちょうどなら受け付ける", () => {
    const result = categorySchema.safeParse({ ...valid, name: "あ".repeat(50) });
    expect(result.success).toBe(true);
  });

  it("type が不正ならエラーになる", () => {
    const result = categorySchema.safeParse({ ...valid, type: "transfer" });
    expect(result.success).toBe(false);
  });

  it("type は both も受け付ける", () => {
    const result = categorySchema.safeParse({ ...valid, type: "both" });
    expect(result.success).toBe(true);
  });

  it("color がパレット外ならエラーになる", () => {
    const result = categorySchema.safeParse({ ...valid, color: "#000000" });
    expect(result.success).toBe(false);
  });
});

describe("CATEGORY_COLORS", () => {
  it("12色のプリセットを持つ", () => {
    expect(CATEGORY_COLORS).toHaveLength(12);
  });
});
