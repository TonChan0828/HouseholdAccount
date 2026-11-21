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
  test("過大展開するExcelを拒否し、その後も通常の画面を利用できる", async ({ page }) => {
    await createHousehold(page, ephemeralName("展開制限"));
    const wb = new ExcelJS.Workbook();
    const ws = addBudgetSheet(wb, "2026年10月", 100, 100);
    ws.getCell("B14").value = "x".repeat(8 * 1024 * 1024);
    const path = await writeXlsx(wb, "oversized.xlsx");
    await page.goto("/transactions/import");
    await page.getByLabel("Excel ファイル（.xlsx）").setInputFiles(path);
    await page.getByRole("button", { name: "ファイルを読み込む" }).click();
    await expect(page.getByText("Excelファイルが解析上限を超えています。行数やシート数を減らしてください")).toBeVisible();
    await page.goto("/transactions");
    await expect(page.getByRole("heading", { name: "収支", exact: true })).toBeVisible();
  });
  test("Excelをアップロード→プレビュー→確定で収支に反映される", async ({
    page,
  }) => {
    const group = ephemeralName("取込グループ");
    const fixture = await buildFixtureXlsx();

    // グループ作成（作成者=オーナー、デフォルトカテゴリ付与、アクティブ化）
    await createHousehold(page, group);

    // 画面遷移の不安定さに引きずられず取込フローを検証するため、リンク先を確認して直接開く。
    await page.goto("/transactions");
    await expect(page.getByRole("link", { name: "インポート" })).toHaveAttribute(
      "href",
      "/transactions/import",
    );
    await page.goto("/transactions/import");

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

    // 取り込んだ収支が一覧に反映される（絞り込みバーの option と重複するため行にスコープ）
    const rows = page.locator('[data-testid="transaction-row"]');
    await expect(rows.filter({ hasText: "給料" })).toBeVisible();
    await expect(rows.filter({ hasText: "食費" })).toBeVisible();

    // 同じブックを同じ月にもう一度確定しても重複行は増えない。
    await page.goto("/transactions/import");
    await page.getByLabel(/Excel ファイル/).setInputFiles(fixture);
    await page.getByRole("button", { name: "ファイルを読み込む" }).click();
    await page.getByRole("button", { name: /取り込む/ }).click();
    await expect(page).toHaveURL(/imported=0&duplicates=2/);
    await expect(page.getByRole("status")).toContainText("新規 0 件");
    await expect(page.getByRole("status")).toContainText("重複 2 件");
    await expect(page.locator('[data-testid="transaction-row"]')).toHaveCount(2);
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
    await expect(
      page.locator('[data-testid="transaction-row"]').filter({ hasText: "食費" }),
    ).toBeVisible();
  });
});

test("500行のプレビューを操作してもファイルを再解析しない", async ({ page }) => {
  await createHousehold(page, ephemeralName("大容量プレビュー"));
  const wb = new ExcelJS.Workbook();
  for (const month of ["2026年06月", "2026年07月"]) {
    const ws = wb.addWorksheet(month);
    ws.getCell("B1").value = "1 か月の支出";
    for (let row = 2; row <= 251; row += 1) {
      ws.getCell(`B${row}`).value = `費目${row - 1}`;
      ws.getCell(`C${row}`).value = row;
    }
  }
  await page.goto("/transactions/import");
  await page.getByLabel(/Excel ファイル/).setInputFiles(await writeXlsx(wb, "preview.xlsx"));
  await page.getByRole("button", { name: "ファイルを読み込む" }).click();
  await expect(page.getByRole("button", { name: "250 件を取り込む" })).toBeVisible();

  let postCount = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/transactions/import") {
      postCount += 1;
    }
  });
  const latencies: number[] = [];
  for (let iteration = 0; iteration < 5; iteration += 1) {
    for (const [month, edited] of [["2026年06月", "2024-02"], ["2026年07月", "2024-03"]]) {
      const started = Date.now();
      await page.getByLabel("シート", { exact: true }).selectOption(month, { timeout: 1000 });
      await page.getByLabel("対象月").fill(edited, { timeout: 1000 });
      await expect(page.getByText(`対象月: 2024年${Number(edited.slice(5))}月`, { exact: false })).toBeVisible({ timeout: 1000 });
      latencies.push(Date.now() - started);
      const next = page.getByRole("button", { name: "取込予定の次のページ" });
      const pageStarted = Date.now();
      await next.click({ timeout: 1000 });
      await expect(page.getByText("費目51", { exact: true })).toBeVisible({ timeout: 1000 });
      latencies.push(Date.now() - pageStarted);
    }
  }
  expect(postCount).toBe(0);
  expect(Math.max(...latencies)).toBeLessThanOrEqual(1000);
  test.info().annotations.push({ type: "preview_max_ms", description: String(Math.max(...latencies)) });
});

test("数式と日付を保持し、未保存の数式を確認して除外できる", async ({ page }) => {
  await createHousehold(page, ephemeralName("調整行取り込み"));
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("2024年02月");
  sheet.getCell("B1").value = "1 か月の支出";
  sheet.getCell("B2").value = "項目";
  sheet.getCell("C2").value = "金額";
  sheet.getCell("D2").value = "日付";
  sheet.getCell("B3").value = "食費";
  sheet.getCell("C3").value = { formula: "0-3500", result: -3500 };
  sheet.getCell("D3").value = new Date("2024-02-29T00:00:00Z");
  sheet.getCell("B4").value = "日用品";
  sheet.getCell("C4").value = { formula: "1+1" };
  await page.goto("/transactions/import");
  await page.getByLabel(/Excel ファイル/).setInputFiles(await writeXlsx(workbook, "adjustment.xlsx"));
  await page.getByRole("button", { name: "ファイルを読み込む" }).click();

  await expect(page.getByText("2024-02-29", { exact: true })).toBeVisible();
  await expect(page.getByText(/2024年02月 · C4.*計算結果/)).toBeVisible();
  const confirm = page.getByRole("button", { name: "1 件を取り込む" });
  await expect(confirm).toBeDisabled();
  await page.getByRole("checkbox", { name: /エラーの 1 件を除いて/ }).check();
  await confirm.click();
  await expect(page).toHaveURL(/imported=1&duplicates=0/);
  await expect(page.getByTestId("transaction-row").filter({ hasText: "食費" })).toContainText("-¥3,500");
});
