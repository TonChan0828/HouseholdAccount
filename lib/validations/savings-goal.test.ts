import { describe, expect, it } from "vitest";

import { savingsGoalSchema } from "@/lib/validations/savings-goal";

const ok = {
  name: "旅行資金",
  target_amount: "300000",
  start_date: "2026-04-01",
  target_date: "2026-12-31",
};

describe("savingsGoalSchema", () => {
  it("正しい入力を受理する", () => {
    const r = savingsGoalSchema.safeParse(ok);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.target_amount).toBe(300_000);
      expect(r.data.target_date).toBe("2026-12-31");
    }
  });

  it("目標額は四則演算式を評価する", () => {
    const r = savingsGoalSchema.safeParse({ ...ok, target_amount: "30000*10" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.target_amount).toBe(300_000);
  });

  it("期日は空文字なら null", () => {
    const r = savingsGoalSchema.safeParse({ ...ok, target_date: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.target_date).toBeNull();
  });

  it("名前が空なら拒否する", () => {
    expect(savingsGoalSchema.safeParse({ ...ok, name: "  " }).success).toBe(false);
  });

  it("目標額が0以下なら拒否する", () => {
    expect(savingsGoalSchema.safeParse({ ...ok, target_amount: "0" }).success).toBe(false);
  });

  it("期日が開始日以前なら拒否する", () => {
    expect(
      savingsGoalSchema.safeParse({ ...ok, target_date: "2026-04-01" }).success,
    ).toBe(false);
  });
});
