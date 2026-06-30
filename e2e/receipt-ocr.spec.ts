import { expect, test } from "@playwright/test";

import { ephemeralName } from "./constants";

// ユーザーストーリー（27_receipt_ocr）:
//   収支登録フォームから「レシートを読み取る」操作で、画像から金額・日付を
//   プリフィルできる。
//
// 注意: 実際の OCR（Tesseract.js / WASM）はブラウザ内で重く非決定的なため、
//       ここでは入力補助の導線（ボタンの存在）をスモークで検証する。
//       抽出ロジックの正常系/異常系は lib/receipt/parse-receipt.test.ts でカバー。

test.describe("レシートOCR入力補助", () => {
  test("収支登録フォームにレシート読み取りの導線がある", async ({ page }) => {
    const group = ephemeralName("レシートグループ");

    await page.goto("/households");
    await page.getByLabel("グループ名").fill(group);
    await page.getByRole("button", { name: "グループを作成" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/transactions/new");
    await expect(
      page.getByRole("button", { name: "レシートを読み取る" }),
    ).toBeVisible();
  });
});
