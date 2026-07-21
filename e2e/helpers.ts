import { expect, type Locator, type Page } from "@playwright/test";

/**
 * 収支の追加・編集ダイアログ（spec 40）を開き、開いたロケータを返す。
 *
 * ダイアログはクライアント側の onClick で開くため、ページ遷移直後に押すと
 * ハイドレーション前でクリックが空振りすることがある。開くまでクリックを再試行する。
 */
export async function openTransactionDialog(
  page: Page,
  trigger: Locator,
): Promise<Locator> {
  const dialog = page.getByTestId("transaction-dialog");
  await expect(async () => {
    await trigger.click();
    await expect(dialog).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  return dialog;
}

/**
 * グループ選択画面からグループを作成する（作成者=オーナー、デフォルトカテゴリ付与、
 * アクティブ化）。ダッシュボードへ遷移したことまで確認する。
 *
 * `name` には `ephemeralName()` で生成した接頭辞付きの名前を渡すこと
 * （global-setup のクリーンアップ対象にするため）。
 */
export async function createHousehold(page: Page, name: string): Promise<void> {
  await page.goto("/households");
  await page.getByLabel("グループ名").fill(name);
  await page.getByRole("button", { name: "グループを作成" }).click();
  // フルスイート後半は作成済みグループが多く、再検証を含む遷移が
  // Playwright の既定 5 秒を超えることがある。
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
}
