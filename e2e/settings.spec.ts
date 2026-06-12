import { expect, test } from "@playwright/test";

// ログイン済み（storageState）で実行される。
// 注意: 表示名は共有 E2E ユーザーのグローバル状態で、members.spec.ts が表示名 "e2e" に
// 依存している。このテストは末尾で必ず "e2e" に復元すること（fullyParallel のローカル
// 並列実行では稀に競合しうる）。

test.describe("プロフィール設定", () => {
  test("表示名を変更するとヘッダーに反映され、元に戻せる", async ({ page }) => {
    const stamp = Date.now();
    const group = `E2Eプロフィール-${stamp}`;
    const newName = `e2e改${stamp}`;

    // グループを作成してダッシュボード（AppHeader あり）へ
    await page.goto("/households");
    await page.getByLabel("グループ名").fill(group);
    await page.getByRole("button", { name: "グループを作成" }).click();
    await expect(page).toHaveURL(/\/$/);

    // ユーザーメニューからプロフィール設定へ遷移
    await page.getByRole("button", { name: /のメニュー/ }).click();
    await page.getByRole("menuitem", { name: "プロフィール設定" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    // 初期値は前回失敗時の残骸の可能性があるため、特定の値には依存しない
    await expect(page.getByLabel("表示名")).toBeVisible();

    // 表示名を変更して保存すると成功メッセージとヘッダー反映
    await page.getByLabel("表示名").fill(newName);
    await page.getByRole("button", { name: "保存する" }).click();
    await expect(page.getByRole("status")).toHaveText("表示名を更新しました");
    await expect(
      page.getByRole("button", { name: `${newName} のメニュー` }),
    ).toBeVisible();

    // 空白のみはバリデーションエラー（required は通るが trim 後に空になる）
    // role=alert は Next.js のルートアナウンサーにもあるため main 内にスコープする
    await page.getByLabel("表示名").fill("   ");
    await page.getByRole("button", { name: "保存する" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(
      "表示名を入力してください",
    );

    // 復元: 他テストが依存する "e2e" に戻す
    await page.getByLabel("表示名").fill("e2e");
    await page.getByRole("button", { name: "保存する" }).click();
    await expect(page.getByRole("status")).toHaveText("表示名を更新しました");
    await expect(
      page.getByRole("button", { name: "e2e のメニュー" }),
    ).toBeVisible();
  });
});
