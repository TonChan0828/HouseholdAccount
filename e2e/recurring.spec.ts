import { expect, test } from "@playwright/test";

import { ephemeralName } from "./constants";

// ログイン済み（storageState）で実行される。
// 新規グループは period_start_day=1 のため、定期項目の作成時に当期（今月1日）の収支が即時生成される。

test.describe("定期項目", () => {
  test("定期項目を作成すると当期の収支が自動生成され、停止・削除できる", async ({
    page,
  }) => {
    const stamp = Date.now();
    const group = ephemeralName("定期グループ");
    const memo = `サブスク-${stamp}`;

    // グループ作成（作成者=オーナー、デフォルトカテゴリ付与、アクティブ化）
    await page.goto("/households");
    await page.getByLabel("グループ名").fill(group);
    await page.getByRole("button", { name: "グループを作成" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // 定期項目を追加（支出 / 食費 / 7777円）
    await page.goto("/transactions/recurring/new");
    await page.getByLabel("金額").fill("7777");
    await page.getByRole("radio", { name: "食費" }).check();
    await page.getByLabel("メモ").fill(memo);
    await page.getByRole("button", { name: "登録する" }).click();

    // 一覧に定期項目が表示される
    await expect(page).toHaveURL(/\/transactions\/recurring$/);
    const recurringRow = page
      .locator('[data-testid="recurring-row"]')
      .filter({ hasText: memo });
    await expect(recurringRow).toBeVisible();
    await expect(recurringRow).toContainText("¥7,777");

    // 作成時生成により、収支一覧に当期分の取引が現れる
    await page.goto("/transactions");
    const generatedRow = page
      .locator('[data-testid="transaction-row"]')
      .filter({ hasText: memo });
    await expect(generatedRow).toBeVisible();
    await expect(generatedRow).toContainText("¥7,777");

    // 定期項目を停止すると「停止中」になる
    await page.goto("/transactions/recurring");
    await recurringRow.getByRole("button", { name: "停止" }).click();
    await expect(recurringRow).toContainText("停止中");

    // 定期項目を削除すると一覧から消える（生成済みの収支は履歴として残る）
    await recurringRow.getByRole("link", { name: "編集" }).click();
    await expect(page).toHaveURL(/\/transactions\/recurring\/.+\/edit$/);
    await page.getByRole("button", { name: "この定期項目を削除" }).click();

    await expect(page).toHaveURL(/\/transactions\/recurring$/);
    await expect(
      page.locator('[data-testid="recurring-row"]').filter({ hasText: memo }),
    ).toHaveCount(0);

    // 生成済みの収支は残っている
    await page.goto("/transactions");
    await expect(
      page.locator('[data-testid="transaction-row"]').filter({ hasText: memo }),
    ).toBeVisible();
  });
});
