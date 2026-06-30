import { expect, test } from "@playwright/test";

import { ephemeralName } from "./constants";

// ユーザーストーリー（25_amount_expression）:
//   レシートや割り勘の合計を、電卓を使わず金額欄に式のまま入力して登録できる。
//   計算結果に小数が出た場合は四捨五入で整数に丸める。

test.describe("金額の四則演算入力", () => {
  test("金額欄に式を入力すると計算結果で登録される", async ({ page }) => {
    const group = ephemeralName("計算グループ");
    const memo = `レシート合計-${Date.now()}`;

    // グループ作成（作成者=オーナー、アクティブ化）
    await page.goto("/households");
    await page.getByLabel("グループ名").fill(group);
    await page.getByRole("button", { name: "グループを作成" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // 金額欄に式を入力（1280+980+550 = 2810）
    await page.goto("/transactions/new");
    await page.getByLabel("金額").fill("1280+980+550");
    await page.getByRole("radio", { name: "食費" }).check();
    await page.getByLabel("メモ").fill(memo);
    await page.getByRole("button", { name: "登録する" }).click();

    // 一覧に計算結果（¥2,810）で登録される
    await expect(page).toHaveURL(/\/transactions$/);
    const row = page
      .locator('[data-testid="transaction-row"]')
      .filter({ hasText: memo });
    await expect(row).toBeVisible();
    await expect(row).toContainText("¥2,810");
  });
});
