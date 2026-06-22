import { expect, test } from "@playwright/test";

import { ephemeralName } from "./constants";

// ログイン済み（storageState）で実行される。
// ダッシュボードは当期間のサマリーと最近の取引を表示する。各テストでグループを作成する。

test.describe("ダッシュボード", () => {
  test("収支を追加するとサマリーと最近の取引に反映され、全体/自分を切り替えられる", async ({
    page,
  }) => {
    const stamp = Date.now();
    const group = ephemeralName("ダッシュボード");
    const memo = `ランチ-${stamp}`;

    // グループ作成（作成者=オーナー、デフォルトカテゴリ付与、アクティブ化）→ ダッシュボードへ
    await page.goto("/households");
    await page.getByLabel("グループ名").fill(group);
    await page.getByRole("button", { name: "グループを作成" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // 収支を追加（支出 / 食費 / 1200円）
    await page.goto("/transactions/new");
    await page.getByLabel("金額").fill("1200");
    await page.getByRole("radio", { name: "食費" }).check();
    await page.getByLabel("メモ").fill(memo);
    await page.getByRole("button", { name: "登録する" }).click();
    await expect(page).toHaveURL(/\/transactions$/);

    // ダッシュボードでサマリー（支出計）に反映される
    await page.goto("/dashboard");
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

  test("月を移動でき、スコープを保持したまま期間を切り替えられる", async ({
    page,
  }) => {
    const stamp = Date.now();
    const group = ephemeralName("月移動");
    const memo = `当月ランチ-${stamp}`;

    // グループ作成 → ダッシュボードへ
    await page.goto("/households");
    await page.getByLabel("グループ名").fill(group);
    await page.getByRole("button", { name: "グループを作成" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // 当月に収支を追加（支出 / 食費 / 1200円）
    await page.goto("/transactions/new");
    await page.getByLabel("金額").fill("1200");
    await page.getByRole("radio", { name: "食費" }).check();
    await page.getByLabel("メモ").fill(memo);
    await page.getByRole("button", { name: "登録する" }).click();
    await expect(page).toHaveURL(/\/transactions$/);

    // ダッシュボードに当月の取引が表示される
    await page.goto("/dashboard");
    await expect(
      page
        .locator('[data-testid="dashboard-transaction-row"]')
        .filter({ hasText: memo }),
    ).toBeVisible();

    // 前の期間へ移動すると ?ref= が付き、当該期間に取引が無いプレースホルダになる
    await page.getByRole("link", { name: "前の期間" }).click();
    await expect(page).toHaveURL(/\/dashboard\?ref=/);
    await expect(
      page.getByText("この期間の収支はまだありません。"),
    ).toBeVisible();

    // 「自分」に切り替えても表示中の月（ref）が維持される
    await page.getByRole("link", { name: "自分" }).click();
    await expect(page).toHaveURL(/scope=mine/);
    await expect(page).toHaveURL(/ref=/);

    // 当月へ戻ると（次の期間）scope=mine が維持され、自分の取引が再表示される
    await page.getByRole("link", { name: "次の期間" }).click();
    await expect(page).toHaveURL(/scope=mine/);
    await expect(
      page
        .locator('[data-testid="dashboard-transaction-row"]')
        .filter({ hasText: memo }),
    ).toBeVisible();
  });

  test("前の期間を見ているとき記録するとフォームの日付がその期間を引き継ぐ", async ({
    page,
  }) => {
    const group = ephemeralName("記録月引継ぎ");

    await page.goto("/households");
    await page.getByLabel("グループ名").fill(group);
    await page.getByRole("button", { name: "グループを作成" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // 前の期間へ移動し、ラベルから期間開始日（YYYY/MM/01）を読む
    await page.getByRole("link", { name: "前の期間" }).click();
    await expect(page).toHaveURL(/\/dashboard\?ref=(\d{4}-\d{2}-\d{2})/);
    const ref = new URL(page.url()).searchParams.get("ref");
    expect(ref).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // 「記録する」へ遷移すると ?date= に期間開始日が引き継がれる
    await page.getByRole("link", { name: "記録する" }).click();
    await expect(page).toHaveURL(`/transactions/new?date=${ref}`);

    // 日付フィールドの既定値が当該期間の開始日になっている（今日ではない）
    await expect(page.getByLabel("日付")).toHaveValue(ref as string);

    // 「すべて見る」も同じ期間（ref）を引き継ぐ
    await page.goto(`/dashboard?ref=${ref}`);
    await page.getByRole("link", { name: "すべて見る" }).click();
    await expect(page).toHaveURL(`/transactions?ref=${ref}`);
  });

  test("当期を見ているとき記録するは日付パラメータを付けない", async ({
    page,
  }) => {
    const group = ephemeralName("記録当月");

    await page.goto("/households");
    await page.getByLabel("グループ名").fill(group);
    await page.getByRole("button", { name: "グループを作成" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // 当期表示のまま「記録する」→ date パラメータは付かない（フォームは今日を既定にする）
    await page.getByRole("link", { name: "記録する" }).click();
    await expect(page).toHaveURL(/\/transactions\/new$/);
  });

  test("ログイン済みで / に来るとグループ選択へリダイレクトされる", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/households$/);
  });
});
