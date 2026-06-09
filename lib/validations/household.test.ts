import { describe, expect, it } from "vitest";

import {
  createHouseholdSchema,
  invitationLimitSchema,
  periodStartDaySchema,
} from "./household";

describe("createHouseholdSchema", () => {
  it("1〜100文字のグループ名を受け付ける", () => {
    const result = createHouseholdSchema.safeParse({ name: "我が家" });
    expect(result.success).toBe(true);
  });

  it("前後の空白を取り除く", () => {
    const result = createHouseholdSchema.safeParse({ name: "  我が家  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("我が家");
    }
  });

  it("空のグループ名を拒否する", () => {
    const result = createHouseholdSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("空白のみのグループ名を拒否する", () => {
    const result = createHouseholdSchema.safeParse({ name: "   " });
    expect(result.success).toBe(false);
  });

  it("100文字を超えるグループ名を拒否する", () => {
    const result = createHouseholdSchema.safeParse({ name: "あ".repeat(101) });
    expect(result.success).toBe(false);
  });
});

describe("invitationLimitSchema", () => {
  it("1〜50の人数上限を受け付ける", () => {
    expect(invitationLimitSchema.safeParse({ maxUses: 3 }).success).toBe(true);
    expect(invitationLimitSchema.safeParse({ maxUses: 1 }).success).toBe(true);
    expect(invitationLimitSchema.safeParse({ maxUses: 50 }).success).toBe(true);
  });

  it("文字列の数値を数値に変換する", () => {
    const result = invitationLimitSchema.safeParse({ maxUses: "5" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxUses).toBe(5);
    }
  });

  it("0以下を拒否する", () => {
    expect(invitationLimitSchema.safeParse({ maxUses: 0 }).success).toBe(false);
  });

  it("50を超える値を拒否する", () => {
    expect(invitationLimitSchema.safeParse({ maxUses: 51 }).success).toBe(false);
  });

  it("小数を拒否する", () => {
    expect(invitationLimitSchema.safeParse({ maxUses: 2.5 }).success).toBe(false);
  });
});

describe("periodStartDaySchema", () => {
  it("1〜28の開始日を受け付ける", () => {
    expect(periodStartDaySchema.safeParse({ periodStartDay: 1 }).success).toBe(
      true,
    );
    expect(periodStartDaySchema.safeParse({ periodStartDay: 28 }).success).toBe(
      true,
    );
  });

  it("文字列を数値に変換する", () => {
    const result = periodStartDaySchema.safeParse({ periodStartDay: "25" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.periodStartDay).toBe(25);
    }
  });

  it("0以下・29以上を拒否する", () => {
    expect(periodStartDaySchema.safeParse({ periodStartDay: 0 }).success).toBe(
      false,
    );
    expect(periodStartDaySchema.safeParse({ periodStartDay: 29 }).success).toBe(
      false,
    );
  });
});
