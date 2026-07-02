import { expect, test } from "@playwright/test";

import { ephemeralName } from "./constants";
import { createHousehold } from "./helpers";

// ログイン済み（storageState）で実行される。
// カテゴリはグループ共有のため、各テストでグループを作成する。

test.describe("カテゴリ管理", () => {
  test("カテゴリを追加・編集・削除でき、収支フォームに反映される", async ({
    page,
  }) => {
    const stamp = Date.now();
    const group = ephemeralName("カテゴリ");
    const name = `ペット-${stamp}`;
    const renamed = `ペット改-${stamp}`;

    // グループ作成（デフォルトカテゴリ付与、アクティブ化）
    await createHousehold(page, group);

    // カテゴリを追加（支出）
    await page.goto("/categories/new");
    await page.getByLabel("カテゴリ名").fill(name);
    await page.getByRole("radio", { name: "支出" }).check();
    await page.getByRole("button", { name: "追加する" }).click();

    // 一覧に表示される
    await expect(page).toHaveURL(/\/categories$/);
    const row = page
      .locator('[data-testid="category-row"]')
      .filter({ hasText: name });
    await expect(row).toBeVisible();

    // デフォルトカテゴリには操作ボタンが無い
    const defaultRow = page
      .locator('[data-testid="category-row"]')
      .filter({ hasText: "食費" });
    await expect(defaultRow.getByText("デフォルト")).toBeVisible();
    await expect(defaultRow.getByRole("link", { name: "編集" })).toHaveCount(0);

    // 収支フォームの選択肢に反映される
    await page.goto("/transactions/new");
    await expect(
      page.getByRole("radio", { name }),
    ).toBeVisible();

    // 編集して名前を変更
    await page.goto("/categories");
    await row.getByRole("link", { name: "編集" }).click();
    await expect(page).toHaveURL(/\/categories\/.+\/edit$/);
    await page.getByLabel("カテゴリ名").fill(renamed);
    await page.getByRole("button", { name: "更新する" }).click();

    await expect(page).toHaveURL(/\/categories$/);
    const renamedRow = page
      .locator('[data-testid="category-row"]')
      .filter({ hasText: renamed });
    await expect(renamedRow).toBeVisible();

    // 削除（confirm 承諾）で一覧から消える
    page.once("dialog", (dialog) => dialog.accept());
    await renamedRow.getByRole("button", { name: "削除" }).click();
    await expect(
      page
        .locator('[data-testid="category-row"]')
        .filter({ hasText: renamed }),
    ).toHaveCount(0);
  });
});
