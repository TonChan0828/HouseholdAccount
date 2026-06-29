import { describe, expect, it } from "vitest";

import { buildSavingsProgress } from "@/lib/savings-goal";

const base = {
  name: "旅行資金",
  targetAmount: 300_000,
  startDate: "2026-04-01",
  targetDate: null as string | null,
};
const today = new Date("2026-06-29T00:00:00Z");

describe("buildSavingsProgress", () => {
  it("期日なしは進捗率・残額を出しペースは null", () => {
    const r = buildSavingsProgress(base, 80_000, today);
    expect(r.saved).toBe(80_000);
    expect(r.pct).toBe(27); // round(80000/300000*100)=27
    expect(r.remaining).toBe(220_000);
    expect(r.reached).toBe(false);
    expect(r.pace).toBeNull();
  });

  it("達成済みは reached=true・remaining=0・pace=null", () => {
    const r = buildSavingsProgress(
      { ...base, targetDate: "2026-12-31" },
      300_000,
      today,
    );
    expect(r.reached).toBe(true);
    expect(r.remaining).toBe(0);
    expect(r.pace).toBeNull();
  });

  it("超過貯金でも pct は 100 を超える（頭打ちしない）", () => {
    const r = buildSavingsProgress(base, 360_000, today);
    expect(r.pct).toBe(120);
    expect(r.reached).toBe(true);
    expect(r.remaining).toBe(0);
  });

  it("負の貯金は進捗0%・残額は目標全額", () => {
    const r = buildSavingsProgress(base, -50_000, today);
    expect(r.pct).toBe(0);
    expect(r.remaining).toBe(300_000);
    expect(r.reached).toBe(false);
  });

  it("期日ありはペース（残り月数・月あたり必要額）を出す", () => {
    // 2026-06-29 → 2026-12-31 は 185 日。ceil(185/30)=7 ヶ月。
    const r = buildSavingsProgress(
      { ...base, targetDate: "2026-12-31" },
      80_000,
      today,
    );
    expect(r.pace).not.toBeNull();
    expect(r.pace?.overdue).toBe(false);
    expect(r.pace?.monthsLeft).toBe(7);
    // ceil(220000/7)=31429
    expect(r.pace?.requiredPerMonth).toBe(31_429);
  });

  it("期日超過かつ未達は overdue=true", () => {
    const r = buildSavingsProgress(
      { ...base, targetDate: "2026-06-01" },
      80_000,
      today,
    );
    expect(r.pace?.overdue).toBe(true);
    expect(r.remaining).toBe(220_000);
  });
});
