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

  // 最新の機能（カレンダー・予算）がガイドとして独立セクションで存在すること。
  it("カレンダーと予算のセクションがある", () => {
    const ids = HELP_SECTIONS.map((section) => section.id);
    expect(ids).toContain("calendar");
    expect(ids).toContain("budget");
  });

  function findSection(id: string) {
    const section = HELP_SECTIONS.find((s) => s.id === id);
    if (!section) throw new Error(`section ${id} not found`);
    return section;
  }

  it("収支セクションがレシート読み取り・式入力・他グループ反映・インポートに触れている", () => {
    const steps = findSection("transactions").steps.join("\n");
    expect(steps).toMatch(/レシート/);
    expect(steps).toMatch(/計算|＋|\+ − × ÷|式/);
    expect(steps).toMatch(/他のグループ/);
    expect(steps).toMatch(/インポート|取り込み|取込/);
  });

  it("分析セクションが家計アドバイスに触れている", () => {
    const steps = findSection("analytics").steps.join("\n");
    expect(steps).toMatch(/家計アドバイス|アドバイス/);
  });

  it("グループ管理セクションがグループ毎の表示名に触れている", () => {
    const steps = findSection("household").steps.join("\n");
    expect(steps).toMatch(/このグループでの表示名|ニックネーム/);
  });
});
