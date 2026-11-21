import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { ephemeralName } from "./constants";
import { createHousehold } from "./helpers";

// ログイン済み（storageState）で実行される。
// CSV 出力には収支データが必要なため、各テストでグループと収支を作成する。

test.describe("収支のCSV出力", () => {
  test("現在期間の収支をCSVでダウンロードできる", async ({ page }) => {
    const stamp = Date.now();
    const group = ephemeralName("出力グループ");
    const memo = `エクスポート-${stamp}`;

    // グループ作成（作成者=オーナー、デフォルトカテゴリ付与、アクティブ化）
    await createHousehold(page, group);

    // 収支を1件追加（支出 / 食費 / 4200円）
    await page.goto("/transactions/new");
    await page.getByLabel("金額").fill("4200");
    await page.getByRole("radio", { name: "食費" }).check();
    await page.getByLabel("メモ").fill(memo);
    await page.getByRole("button", { name: "登録する" }).click();
    await expect(page).toHaveURL(/\/transactions$/);

    // 「CSV出力」をクリックしてダウンロードを捕捉
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "CSV出力" }).click();
    const download = await downloadPromise;

    // ファイル名が transactions_ で始まる
    expect(download.suggestedFilename()).toMatch(/^transactions_.*\.csv$/);

    // 中身に登録した金額・カテゴリ・メモが含まれる
    const path = await download.path();
    const csv = readFileSync(path, "utf-8");
    expect(csv).toContain("日付,種別,カテゴリ,金額,メモ,登録者");
    expect(csv).toContain("4200");
    expect(csv).toContain("食費");
    expect(csv).toContain(memo);

    await page.getByText("CSV出力の期間指定", { exact: true }).click();
    await page.getByLabel("開始日").fill("2024-02-29");
    await page.getByLabel("終了日").fill("2024-02-29");
    const datedDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "CSVをダウンロード" }).click();
    const datedDownload = await datedDownloadPromise;
    expect(datedDownload.suggestedFilename()).toBe("transactions_2024-02-29_2024-02-29.csv");
    expect(readFileSync(await datedDownload.path(), "utf-8")).not.toContain(memo);
  });
});
