import { expect, test } from "@playwright/test";

import { E2E_USER } from "./constants";

// ユーザーストーリー（14_account_deletion）:
//   退会したいユーザーとして、設定画面で確認フレーズ（登録メールアドレス）を
//   入力したときのみアカウント削除を実行でき、誤操作では実行できない。
//
// 注意: このテストは「誤操作防止のゲーティング」だけを検証し、実際には削除しない
//       （E2E ユーザーは他テストの共有フィクスチャのため。削除ボタンは押さない）。

test.describe("アカウント削除（退会）", () => {
  test("確認フレーズが一致するまで削除ボタンは無効", async ({ page }) => {
    await page.goto("/settings");

    const deleteButton = page.getByRole("button", {
      name: "アカウントを削除する",
    });
    const confirmInput = page.getByLabel("確認のためメールアドレスを入力");

    // 初期状態: 未入力なので無効
    await expect(deleteButton).toBeVisible();
    await expect(deleteButton).toBeDisabled();

    // 異常系: 誤ったフレーズでは無効のまま
    await confirmInput.fill("wrong@example.com");
    await expect(deleteButton).toBeDisabled();

    // 正常系: 登録メールアドレスと完全一致で有効になる（※削除は実行しない）
    await confirmInput.fill(E2E_USER.email);
    await expect(deleteButton).toBeEnabled();
  });
});
