import { describe, expect, it } from "vitest";

import { profileSchema } from "./profile";

describe("profileSchema", () => {
  it("正しい入力を受け付ける", () => {
    const result = profileSchema.safeParse({ displayName: "たろう" });
    expect(result.success).toBe(true);
  });

  it("前後の空白を除去する", () => {
    const result = profileSchema.safeParse({ displayName: "  たろう  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.displayName).toBe("たろう");
    }
  });

  it("空文字ならエラーになる", () => {
    const result = profileSchema.safeParse({ displayName: "" });
    expect(result.success).toBe(false);
  });

  it("空白のみならエラーになる", () => {
    const result = profileSchema.safeParse({ displayName: "   " });
    expect(result.success).toBe(false);
  });

  it("21文字以上ならエラーになる", () => {
    const result = profileSchema.safeParse({ displayName: "あ".repeat(21) });
    expect(result.success).toBe(false);
  });

  it("20文字ちょうどなら受け付ける", () => {
    const result = profileSchema.safeParse({ displayName: "あ".repeat(20) });
    expect(result.success).toBe(true);
  });
});
