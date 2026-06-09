import { expect, test as setup } from "@playwright/test";

import { E2E_USER, STORAGE_STATE } from "./constants";

// UI からログインして、アプリが設定する Cookie をそのまま storageState に保存する。
setup("認証してセッションを保存する", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(E2E_USER.email);
  await page.getByLabel("パスワード").fill(E2E_USER.password);
  await page.getByRole("button", { name: "ログイン" }).click();

  // ログイン成功でグループ選択画面へ遷移する
  await expect(page).toHaveURL(/\/households$/);
  await page.context().storageState({ path: STORAGE_STATE });
});
