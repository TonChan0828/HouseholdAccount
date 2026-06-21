import { describe, expect, it } from "vitest";

import { TONE_CHIP, TONE_TEXT } from "./tone";

describe("tone tokens", () => {
  it("チップ配色は income/expense/neutral を網羅する", () => {
    expect(TONE_CHIP.income).toContain("text-income");
    expect(TONE_CHIP.expense).toContain("text-expense");
    expect(TONE_CHIP.neutral).toContain("text-secondary-foreground");
  });

  it("数値文字色は income/expense/neutral を網羅する", () => {
    expect(TONE_TEXT.income).toBe("text-income");
    expect(TONE_TEXT.expense).toBe("text-expense");
    expect(TONE_TEXT.neutral).toBe("text-foreground");
  });
});
