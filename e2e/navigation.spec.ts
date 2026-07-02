import { expect, test } from "@playwright/test";

import { ephemeralName } from "./constants";
import { createHousehold } from "./helpers";

// ユーザーストーリー（00_overview / 08_ui_overhaul）:
//   ログイン済みメンバーとして、共通のアプリシェル（ヘッダーのメインナビ）から
//   各画面へ移動でき、ホームに戻れる。

test.describe("アプリシェルのナビゲーション", () => {
  test("ヘッダーのメインナビから各画面へ遷移できる", async ({ page }) => {
    const group = ephemeralName("ナビグループ");

    // グループ作成（作成者=オーナー、アクティブ化）→ ダッシュボード
    await createHousehold(page, group);

    const nav = page.getByRole("navigation", { name: "メイン" });

    await nav.getByRole("link", { name: "収支", exact: true }).click();
    await expect(page).toHaveURL(/\/transactions$/);

    await nav.getByRole("link", { name: "カレンダー" }).click();
    await expect(page).toHaveURL(/\/calendar$/);

    await nav.getByRole("link", { name: "分析" }).click();
    await expect(page).toHaveURL(/\/analytics$/);

    await nav.getByRole("link", { name: "予算" }).click();
    await expect(page).toHaveURL(/\/budgets$/);

    await nav.getByRole("link", { name: "メンバー" }).click();
    await expect(page).toHaveURL(/\/members$/);

    await nav.getByRole("link", { name: "カテゴリ" }).click();
    await expect(page).toHaveURL(/\/categories$/);

    await nav.getByRole("link", { name: "ホーム" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
