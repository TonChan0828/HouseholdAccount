import { describe, expect, it } from "vitest";

import { shouldShowNoTransactionsReminder } from "@/lib/reminder";

const base = { viewingCurrent: true, transactionCount: 0, daysRemaining: 3 };

describe("shouldShowNoTransactionsReminder", () => {
  it("当期表示中・登録0件・残り3日以内なら true", () => {
    expect(shouldShowNoTransactionsReminder(base)).toBe(true);
  });

  it("境界値: 残り3日ちょうどは true", () => {
    expect(
      shouldShowNoTransactionsReminder({ ...base, daysRemaining: 3 }),
    ).toBe(true);
  });

  it("残り4日は false（閾値超過）", () => {
    expect(
      shouldShowNoTransactionsReminder({ ...base, daysRemaining: 4 }),
    ).toBe(false);
  });

  it("当期を表示していない（過去/未来期間）なら false", () => {
    expect(
      shouldShowNoTransactionsReminder({ ...base, viewingCurrent: false }),
    ).toBe(false);
  });

  it("すでに1件でも登録されていれば false", () => {
    expect(
      shouldShowNoTransactionsReminder({ ...base, transactionCount: 1 }),
    ).toBe(false);
  });
});
