import { expect, test } from "@playwright/test";

import { ephemeralName } from "./constants";

// ログイン済み（storageState）で実行される。
// 家計アドバイスはルールベース（lib/advice.ts）。当期の収支から決定的に生成される。

test.describe("家計アドバイス", () => {
  test("収支に応じてルールベースの助言が分析画面に表示される", async ({
    page,
  }) => {
    const group = ephemeralName("助言グループ");

    // グループ作成（作成者=オーナー、アクティブ化）
    await page.goto("/households");
    await page.getByLabel("グループ名").fill(group);
    await page.getByRole("button", { name: "グループを作成" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // データ不足時は案内文言（no-data）が出る
    await page.goto("/analytics");
    await expect(
      page.getByText("まだ分析できる支出がありません"),
    ).toBeVisible();

    // 収入 100,000・支出 20,000 を登録 → 貯蓄率 80%（good-savings）
    await page.goto("/transactions/new");
    await page.locator('label:has(input[value="income"])').click();
    await page.getByLabel("金額").fill("100000");
    await page.getByRole("radio", { name: "給与" }).check();
    await page.getByRole("button", { name: "登録する" }).click();
    await expect(page).toHaveURL(/\/transactions$/);

    await page.goto("/transactions/new");
    await page.getByLabel("金額").fill("20000");
    await page.getByRole("radio", { name: "食費" }).check();
    await page.getByRole("button", { name: "登録する" }).click();
    await expect(page).toHaveURL(/\/transactions$/);

    // 分析画面に家計アドバイスが表示され、貯蓄率達成の助言が出る
    await page.goto("/analytics");
    await expect(
      page.getByRole("heading", { name: "家計アドバイス" }),
    ).toBeVisible();
    await expect(page.getByText("貯蓄率 80% を達成しています")).toBeVisible();
  });
});
