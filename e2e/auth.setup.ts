import { expect, test as setup } from "@playwright/test";

import { workerFixtures, E2E_USER } from "./constants";

// UI からログインして、アプリが設定する Cookie をそのまま storageState に保存する。
// 並列ワーカーはそれぞれ別のユーザーを使うため、ワーカー数ぶんのセッションを作る。
setup("認証してセッションを保存する", async ({ browser, baseURL }, testInfo) => {
  for (let index = 0; index < testInfo.config.workers; index++) {
    const fixtures = workerFixtures(index);
    const context = await browser.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();
    await page.goto("/login");
    await page.getByLabel("メールアドレス").fill(fixtures.ownerEmail);
    await page.getByLabel("パスワード").fill(E2E_USER.password);
    await page.getByRole("button", { name: "ログイン" }).click();

    // ログイン成功でグループ選択画面へ遷移する
    await expect(page).toHaveURL(/\/households$/);
    await context.storageState({ path: fixtures.storageState });
    await context.close();
  }
});
