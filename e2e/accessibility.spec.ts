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
      const main = page.locator("main");
      await expect(main).toBeVisible();

      // axe が fade-in の途中を測ると、半透明の前景色を背景へ合成した値で
      // color-contrast を誤検出する。main 配下の初期アニメーション完了後を検査する。
      await main.evaluate(async (element) => {
        await Promise.all(
          element
            .getAnimations({ subtree: true })
            .map((animation) => animation.finished),
        );
      });

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      expect(results.violations).toEqual([]);
    });
  }
});
