import { describe, expect, it } from "vitest";

import { HELP_SECTIONS } from "./help-content";

describe("HELP_SECTIONS", () => {
  it("セクションが1件以上ある", () => {
    expect(HELP_SECTIONS.length).toBeGreaterThan(0);
  });

  it("各セクションが必須フィールドを持つ", () => {
    for (const section of HELP_SECTIONS) {
      expect(section.id).toBeTruthy();
      expect(section.title).toBeTruthy();
      expect(section.description).toBeTruthy();
      expect(section.icon).toBeTruthy();
      expect(section.steps.length).toBeGreaterThan(0);
      expect(section.steps.every((step) => step.trim().length > 0)).toBe(true);
    }
  });

  it("id がユニークである", () => {
    const ids = HELP_SECTIONS.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
