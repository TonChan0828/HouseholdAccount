import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import ExcelJS from "exceljs";
import { expect, test } from "@playwright/test";

import { ephemeralName } from "./constants";
import { createHousehold } from "./helpers";

// ログイン済み（storageState）で実行される。
// 取り込みには Excel ファイルが必要なため、合成フィクスチャ（実データは使わない）を生成する。

/** 「月々の収支（簡易版）」テンプレートと同じセクション構造のシートをブックに追加する。 */
function addBudgetSheet(
  wb: ExcelJS.Workbook,
  name: string,
  income: number,
  expense: number,
) {
  const ws = wb.addWorksheet(name);
  ws.getCell("B4").value = "1 か月の収入";
  ws.getCell("B6").value = "項目";
  ws.getCell("C6").value = "金額";
  ws.getCell("B7").value = "給料";
  ws.getCell("C7").value = income;
  ws.getCell("B12").value = "1 か月の支出";
  ws.getCell("B13").value = "項目";
  ws.getCell("C13").value = "金額";
  ws.getCell("B14").value = "食費";
  ws.getCell("C14").value = expense;
  ws.getCell("B15").value = "イオンカード"; // 金額なし → スキップ
  return ws;
}

/** xlsx を一時ファイルに書き出してパスを返す。 */
async function writeXlsx(wb: ExcelJS.Workbook, fileName: string): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "e2e-import-"));
  const path = join(dir, fileName);
  writeFileSync(path, Buffer.from(await wb.xlsx.writeBuffer()));
  return path;
}

/** テンプレ1枚 + 空 Sheet1 の .xlsx を生成してパスを返す。 */
async function buildFixtureXlsx(): Promise<string> {
  const wb = new ExcelJS.Workbook();
  addBudgetSheet(wb, "月々の収支 (簡易版)", 318000, 24224);
  wb.addWorksheet("Sheet1"); // 空シート（取り込み対象外）
  return writeXlsx(wb, "2026年06月家計簿.xlsx");
}

/** 月ごとに2枚のテンプレシートを持つ .xlsx を生成してパスを返す。 */
async function buildMultiSheetXlsx(): Promise<string> {
  const wb = new ExcelJS.Workbook();
  addBudgetSheet(wb, "2026年06月", 318000, 24224);
  addBudgetSheet(wb, "2026年07月", 305000, 31000);
  return writeXlsx(wb, "家計簿2026.xlsx");
}

test.describe("Excel取り込み", () => {
  test("Excelをアップロード→プレビュー→確定で収支に反映される", async ({
    page,
  }) => {
    const group = ephemeralName("取込グループ");
    const fixture = await buildFixtureXlsx();

    // グループ作成（作成者=オーナー、デフォルトカテゴリ付与、アクティブ化）
    await createHousehold(page, group);

    // インポート画面へ
    await page.goto("/transactions");
    await page.getByRole("link", { name: "インポート" }).click();
    await expect(page).toHaveURL(/\/transactions\/import$/);

    // ファイルを選択して読み込み
    await page.getByLabel(/Excel ファイル/).setInputFiles(fixture);
    await page.getByRole("button", { name: "ファイルを読み込む" }).click();

    // プレビュー: 有効2件（給料・食費）、スキップ1件（イオンカード）
    await expect(page.getByText("給料")).toBeVisible();
    await expect(page.getByText("食費")).toBeVisible();
    await expect(page.getByText(/取込予定/)).toContainText("2");
    // 対象月はファイル名から推定される
    await expect(page.getByLabel("対象月")).toHaveValue("2026-06");

    // 確定して取り込み
    await page.getByRole("button", { name: /取り込む/ }).click();
    await expect(page).toHaveURL(/\/transactions\?ref=2026-06-01/);

    // 取り込んだ収支が一覧に反映される
    await expect(page.getByText("給料")).toBeVisible();
    await expect(page.getByText("食費")).toBeVisible();
  });

  test("複数シートのExcelはシートを選択して取り込める", async ({ page }) => {
    const group = ephemeralName("複数タブ取込");
    const fixture = await buildMultiSheetXlsx();

    await createHousehold(page, group);

    await page.goto("/transactions/import");
    await page.getByLabel(/Excel ファイル/).setInputFiles(fixture);
    await page.getByRole("button", { name: "ファイルを読み込む" }).click();

    // シート選択セレクタが表示され、2枚目を選ぶと対象月が切り替わる
    const sheetSelect = page.getByLabel("シート", { exact: true });
    await expect(sheetSelect).toBeVisible();
    await expect(page.getByLabel("対象月")).toHaveValue("2026-06");
    await sheetSelect.selectOption("2026年07月");
    await expect(page.getByLabel("対象月")).toHaveValue("2026-07");

    // 選んだシート（7月）を確定 → その月に反映
    await page.getByRole("button", { name: /取り込む/ }).click();
    await expect(page).toHaveURL(/\/transactions\?ref=2026-07-01/);
    await expect(page.getByText("食費")).toBeVisible();
  });
});
