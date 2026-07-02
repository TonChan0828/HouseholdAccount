import { expect, type Page } from "@playwright/test";

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
  await expect(page).toHaveURL(/\/dashboard$/);
}
