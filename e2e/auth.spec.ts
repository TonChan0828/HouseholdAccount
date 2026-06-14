import { expect, test } from "@playwright/test";

test.describe("認証ルーティング", () => {
  test("未認証でダッシュボードにアクセスするとログインへリダイレクトされる", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel("メールアドレス")).toBeVisible();
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
      page.getByRole("button", { name: "登録する" }),
    ).toBeVisible();
  });

  test("未認証で / にアクセスするとランディングが表示される", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", { name: /家計を[\s\S]*みんなで一緒に。/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /無料で始める/ }).first(),
    ).toHaveAttribute("href", "/register");
  });
});
