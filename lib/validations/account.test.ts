import { describe, expect, it } from "vitest";

import { accountDeletionSchema } from "./account";

describe("accountDeletionSchema", () => {
  it("確認フレーズが空の場合は失敗する", () => {
    expect(accountDeletionSchema.safeParse({ confirmText: "" }).success).toBe(
      false,
    );
  });

  it("確認フレーズがあれば成功し、前後の空白を除去する", () => {
    const result = accountDeletionSchema.safeParse({
      confirmText: "  me@example.com  ",
    });
    expect(result.success).toBe(true);
    expect(result.data?.confirmText).toBe("me@example.com");
  });
});
