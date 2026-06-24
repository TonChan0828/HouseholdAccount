import { expect, test } from "@playwright/test";

// デモモードは未認証（ゲスト）で動作する。chromium-guest プロジェクトで実行する。
test.describe("デモモード", () => {
  test("ランディングから未認証でデモへ入れる", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("link", { name: "デモを試す" })
      .click();
    await expect(page).toHaveURL(/\/demo\/dashboard$/);
    // 保存されない旨のバナーが常時表示される
    await expect(
      page.getByText("入力したデータは保存されず"),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "無料で登録して保存" }),
    ).toHaveAttribute("href", "/register");
  });

  test("サンプルデータが表示される", async ({ page }) => {
    await page.goto("/demo/dashboard");
    await expect(
      page.getByRole("heading", { name: "ダッシュボード" }),
    ).toBeVisible();
    // 当期の収支グラフ・最近の取引が出ている
    await expect(page.getByText("最近の取引")).toBeVisible();
    // 収支一覧にサンプルの取引行がある
    await page.goto("/demo/transactions");
    await expect(
      page.getByTestId("transaction-row").first(),
    ).toBeVisible();
  });

  test("収支を追加すると一覧に反映され、リロードで初期化される", async ({
    page,
  }) => {
    await page.goto("/demo/transactions");
    const before = await page.getByTestId("transaction-row").count();

    await page.getByRole("link", { name: "収支を追加" }).click();
    await expect(page).toHaveURL(/\/demo\/transactions\/new$/);

    await page.getByLabel("金額").fill("4567");
    await page.getByLabel("メモ").fill("デモE2Eの取引");
    await page.getByRole("button", { name: "登録する" }).click();

    await expect(page).toHaveURL(/\/demo\/transactions$/);
    await expect(page.getByText("デモE2Eの取引")).toBeVisible();
    await expect(page.getByTestId("transaction-row")).toHaveCount(before + 1);

    // リロードするとインメモリ状態が破棄され、初期サンプルに戻る
    await page.reload();
    await expect(page.getByText("デモE2Eの取引")).toHaveCount(0);
    await expect(page.getByTestId("transaction-row")).toHaveCount(before);
  });

  test("メンバー4人でも375px幅でマトリクスが横はみ出ししない", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/demo/dashboard");

    // メンバー別カテゴリに4人目（子ども）まで列として現れる
    const matrix = page.getByTestId("matrix-expense");
    await expect(matrix).toBeVisible();
    const headers = matrix.getByRole("columnheader");
    // カテゴリ + メンバー4人 + 合計 = 6列
    await expect(headers).toHaveCount(6);
    await expect(
      matrix.getByRole("columnheader", { name: "子ども" }),
    ).toBeVisible();

    // 表は内部スクロールするため、ページ自体は横方向に溢れない
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });

  test("デフォルトカテゴリは編集・削除できず、カスタムは追加できる", async ({
    page,
  }) => {
    await page.goto("/demo/categories");
    // デフォルトカテゴリ（食費）の行には編集リンクがない
    const foodRow = page
      .getByTestId("category-row")
      .filter({ hasText: "食費" });
    await expect(foodRow.getByText("デフォルト")).toBeVisible();

    // カスタムカテゴリを追加
    await page.getByRole("link", { name: "カテゴリを追加" }).click();
    await page.getByLabel("カテゴリ名").fill("旅行");
    await page.getByRole("button", { name: "追加する" }).click();
    await expect(page).toHaveURL(/\/demo\/categories$/);
    await expect(
      page.getByTestId("category-row").filter({ hasText: "旅行" }),
    ).toBeVisible();
  });
});
