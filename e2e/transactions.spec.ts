import { expect, test } from "@playwright/test";

// ログイン済み（storageState）で実行される。
// 収支操作にはアクティブな household が必要なため、各テストでグループを作成する。

test.describe("収支記録", () => {
  test("収支を追加・編集・削除できる", async ({ page }) => {
    const stamp = Date.now();
    const group = `E2E収支グループ-${stamp}`;
    const memo = `ランチ-${stamp}`;

    // グループ作成（作成者=オーナー、デフォルトカテゴリ付与、アクティブ化）
    await page.goto("/households");
    await page.getByLabel("グループ名").fill(group);
    await page.getByRole("button", { name: "グループを作成" }).click();
    await expect(page).toHaveURL(/\/$/);

    // 収支を追加（支出 / 食費 / 1200円）
    await page.goto("/transactions/new");
    await page.getByLabel("金額").fill("1200");
    await page.getByRole("radio", { name: "食費" }).check();
    await page.getByLabel("メモ").fill(memo);
    await page.getByRole("button", { name: "登録する" }).click();

    // 一覧に表示される
    await expect(page).toHaveURL(/\/transactions$/);
    const row = page
      .locator('[data-testid="transaction-row"]')
      .filter({ hasText: memo });
    await expect(row).toBeVisible();
    await expect(row).toContainText("¥1,200");

    // 編集して金額を変更
    await row.getByRole("link", { name: "編集" }).click();
    await expect(page).toHaveURL(/\/transactions\/.+\/edit$/);
    await page.getByLabel("金額").fill("3500");
    await page.getByRole("button", { name: "更新する" }).click();

    await expect(page).toHaveURL(/\/transactions$/);
    const editedRow = page
      .locator('[data-testid="transaction-row"]')
      .filter({ hasText: memo });
    await expect(editedRow).toContainText("¥3,500");

    // 削除すると一覧から消える
    await editedRow.getByRole("button", { name: "削除" }).click();
    await expect(page).toHaveURL(/\/transactions$/);
    await expect(
      page.locator('[data-testid="transaction-row"]').filter({ hasText: memo }),
    ).toHaveCount(0);
  });
});
