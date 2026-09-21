import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const publicPages = [
  { name: "ランディング", path: "/" },
  { name: "ログイン", path: "/login" },
  { name: "デモダッシュボード", path: "/demo/dashboard" },
] as const;

test.describe("公開画面のアクセシビリティ", () => {
  for (const target of publicPages) {
    test(`${target.name} に重大な自動検出違反がない`, async ({ page }) => {
      await page.goto(target.path);
      await expect(page.locator("main")).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      expect(results.violations).toEqual([]);
    });
  }
});
