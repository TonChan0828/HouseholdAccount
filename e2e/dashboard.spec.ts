import { expect, test } from "@playwright/test";

// ログイン済み（storageState）で実行される。
// ダッシュボードは当期間のサマリーと最近の取引を表示する。各テストでグループを作成する。

test.describe("ダッシュボード", () => {
  test("収支を追加するとサマリーと最近の取引に反映され、全体/自分を切り替えられる", async ({
    page,
  }) => {
    const stamp = Date.now();
    const group = `E2Eダッシュボード-${stamp}`;
    const memo = `ランチ-${stamp}`;

    // グループ作成（作成者=オーナー、デフォルトカテゴリ付与、アクティブ化）→ ダッシュボードへ
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
    await expect(page).toHaveURL(/\/transactions$/);

    // ダッシュボードでサマリー（支出計）に反映される
    await page.goto("/");
    await expect(page.getByTestId("summary-cards")).toContainText("¥1,200");

    // メンバー別カテゴリマトリクスの支出セクションに食費行が表示される
    // （セル・合計列・合計行のメンバー計・総計の4箇所が同額になる）
    const expenseMatrix = page.getByTestId("matrix-expense");
    await expect(expenseMatrix).toContainText("食費");
    await expect(expenseMatrix.getByText("¥1,200")).toHaveCount(4);

    // 最近の取引に追加した行が表示される
    const row = page
      .locator('[data-testid="dashboard-transaction-row"]')
      .filter({ hasText: memo });
    await expect(row).toBeVisible();
    await expect(row).toContainText("¥1,200");

    // 「自分」に切り替えると ?scope=mine になり、自分の取引が残る
    await page.getByRole("link", { name: "自分" }).click();
    await expect(page).toHaveURL(/\?scope=mine$/);
    await expect(
      page
        .locator('[data-testid="dashboard-transaction-row"]')
        .filter({ hasText: memo }),
    ).toBeVisible();

    // マトリクスは scope の影響を受けず表示されたまま
    await expect(page.getByTestId("category-member-matrix")).toBeVisible();
    await expect(page.getByTestId("matrix-expense")).toContainText("食費");

    // 「全体」に戻すと ?scope=all になる
    await page.getByRole("link", { name: "全体" }).click();
    await expect(page).toHaveURL(/\?scope=all$/);
    await expect(page.getByTestId("summary-cards")).toContainText("¥1,200");
  });
});
