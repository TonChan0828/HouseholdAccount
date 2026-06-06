import { expect, test } from "@playwright/test";

test.describe("認証ルーティング", () => {
  test("未認証でダッシュボードにアクセスするとログインへリダイレクトされる", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: "ログイン" }),
    ).toBeVisible();
  });

  test("未認証で /households にアクセスするとログインへリダイレクトされる", async ({
    page,
  }) => {
    await page.goto("/households");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("ログイン画面から新規登録画面へ遷移できる", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "新規登録" }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(
      page.getByRole("heading", { name: "新規登録" }),
    ).toBeVisible();
  });
});
