import { expect, test } from "@playwright/test";

// ログイン済み（storageState）で実行される。
// テーマ切り替え（ライト/ダーク/システム）と localStorage による永続化を検証する。

test.describe("テーマ切り替え", () => {
  test("グループ選択画面のトグルでダークモードに切り替えられ、リロード後も維持される", async ({
    page,
  }) => {
    await page.goto("/households");

    // ダークに切り替えると html に dark クラスが付与される
    await page.getByRole("button", { name: "テーマを切り替え" }).click();
    await page.getByRole("menuitemradio", { name: "ダーク" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    // リロードしてもダークのまま（localStorage 永続化）
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);

    // ライトに戻すと dark クラスが外れる
    await page.getByRole("button", { name: "テーマを切り替え" }).click();
    await page.getByRole("menuitemradio", { name: "ライト" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });

  test("ヘッダーのユーザーメニューからテーマを切り替えられる", async ({
    page,
  }) => {
    const group = `E2Eテーマ-${Date.now()}`;

    // グループを作成してダッシュボード（AppHeader あり）へ
    await page.goto("/households");
    await page.getByLabel("グループ名").fill(group);
    await page.getByRole("button", { name: "グループを作成" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // ユーザーメニュー内のテーマ項目でダークに切り替え
    await page.getByRole("button", { name: /のメニュー/ }).click();
    await page.getByRole("menuitemradio", { name: "ダーク" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    // システムに戻す（OS 設定追従。Playwright デフォルトはライト）
    await page.getByRole("button", { name: /のメニュー/ }).click();
    await page.getByRole("menuitemradio", { name: "システム" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });
});
