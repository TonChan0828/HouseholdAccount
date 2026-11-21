import ExcelJS from "exceljs";
import JSZip from "jszip";
import { expect, it } from "vitest";
import { isAbsolute } from "node:path";
import { parseWorkbook, resolveWorkbookModule, WORKBOOK_LIMITS } from "./parse-workbook";

async function workbook(item = "食費") {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("2026年10月");
  ws.getCell("B1").value = "1 か月の支出";
  ws.getCell("B2").value = item;
  ws.getCell("C2").value = 100;
  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}
async function alter(edit: (zip: JSZip) => Promise<void> | void) {
  const zip = await JSZip.loadAsync(await workbook());
  await edit(zip);
  return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
}

it.each(["exceljs", "yauzl", "saxes", "jszip"])("Turbopackの内部識別子ではなく%sの実パスをスレッドへ渡す", (name) => {
  const resolved = resolveWorkbookModule(name, "[externals]/" + name + " [external]");
  expect(isAbsolute(resolved)).toBe(true);
  expect(resolved).toBe(require.resolve(name));
});
it.each(["exceljs", "yauzl", "saxes", "jszip"])("本番ビルドの数値IDではなく%sの実パスをスレッドへ渡す", (name) => {
  const resolved = resolveWorkbookModule(name, 6928);
  expect(isAbsolute(resolved)).toBe(true);
  expect(resolved).toBe(require.resolve(name));
});

it("通常のブックと文字数上限ちょうどのセルを読み込める", async () => {
  expect((await parseWorkbook(await workbook()))[0].rows[0]).toMatchObject({ item: "食費", amount: 100 });
  expect((await parseWorkbook(await workbook("a".repeat(WORKBOOK_LIMITS.cellCharacters))))[0].rows[0].item).toHaveLength(WORKBOOK_LIMITS.cellCharacters);
});
it("小さく圧縮された巨大セルを拒否する", async () => {
  const buffer = await workbook("a".repeat(8 * 1024 * 1024));
  expect(buffer.byteLength).toBeLessThan(100_000);
  await expect(parseWorkbook(buffer)).rejects.toThrow(/WorkbookLimit|InvalidWorkbook/);
});
it("展開後のエントリー上限を超える圧縮データを拒否する", async () => {
  const buffer = await alter((zip) => { zip.file("large.bin", Buffer.alloc(WORKBOOK_LIMITS.entryBytes + 1)); });
  await expect(parseWorkbook(buffer)).rejects.toThrow(/WorkbookLimit|InvalidWorkbook/);
});
it("エントリー数を制限する", async () => {
  const buffer = await alter((zip) => {
    for (let i = 0; i < WORKBOOK_LIMITS.entries + 1; i++) zip.file("extra" + i, "");
  });
  await expect(parseWorkbook(buffer)).rejects.toThrow(/WorkbookLimit|InvalidWorkbook/);
});
it("複数の小さなエントリーでも展開後の合計を制限する", async () => {
  const buffer = await alter((zip) => {
    for (let i = 0; i < 3; i++) zip.file("payload" + i + ".bin", Buffer.alloc(6 * 1024 * 1024));
  });
  await expect(parseWorkbook(buffer)).rejects.toThrow(/WorkbookLimit|InvalidWorkbook/);
});
it("シート数の上限を超えるブックを拒否する", async () => {
  const wb = new ExcelJS.Workbook();
  for (let i = 0; i <= WORKBOOK_LIMITS.sheets; i++) wb.addWorksheet("sheet" + i);
  await expect(parseWorkbook(await wb.xlsx.writeBuffer() as ArrayBuffer)).rejects.toThrow(/WorkbookLimit|InvalidWorkbook/);
});
it.each([
  ['DOCTYPE', async (zip: JSZip) => { zip.file("extra.xml", '<!DOCTYPE a [<!ENTITY a "x">]><a>&a;</a>'); }],
  ['不正XML', async (zip: JSZip) => { zip.file("extra.xml", '<a>'); }],
  ['疎な巨大座標', async (zip: JSZip) => {
    const sheet = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    zip.file("xl/worksheets/sheet1.xml", sheet.replace('r="B2"', 'r="B1048576"'));
  }],
  ['過大な結合セル', async (zip: JSZip) => {
    const sheet = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    zip.file("xl/worksheets/sheet1.xml", sheet.replace('</worksheet>', '<mergeCells count="1"><mergeCell ref="A1:IV10000"/></mergeCells></worksheet>'));
  }],
] as const)("%sを拒否する", async (_, edit) => {
  await expect(parseWorkbook(await alter(edit))).rejects.toThrow(/WorkbookLimit|InvalidWorkbook/);
});
it("解析が完了しなくてもスレッドを期限で終了する", async () => {
  await expect(parseWorkbook(await workbook(), 1)).rejects.toThrow("WorkbookTimeout");
});

it("保存済みの数式値を読み、未保存の数式値はセル単位の問題にする", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("明細");
  ws.getCell("B1").value = "1 か月の支出";
  ws.getCell("B2").value = "食費";
  ws.getCell("C2").value = { formula: "1+2", result: 3 };
  ws.getCell("B3").value = "交通費";
  ws.getCell("C3").value = { formula: "1+2" };
  const [sheet] = await parseWorkbook(await wb.xlsx.writeBuffer() as ArrayBuffer);
  expect(sheet.rows[0]).toMatchObject({ amount: 3 });
  expect(sheet.rows[1]).toMatchObject({ issue: { cell: "C3", reason: expect.stringContaining("計算結果") } });
});

it.each([false, true])("Excel日付を暦日として保持する (date1904=%s)", async (date1904) => {
  const wb = new ExcelJS.Workbook();
  wb.properties.date1904 = date1904;
  const ws = wb.addWorksheet("明細");
  ws.getCell("B1").value = "1 か月の支出";
  ws.getCell("B2").value = "項目";
  ws.getCell("C2").value = "金額";
  ws.getCell("D2").value = "日付";
  ws.getCell("B3").value = "食費";
  ws.getCell("C3").value = -3500;
  ws.getCell("D3").value = new Date("2024-02-29T00:00:00Z");
  ws.getCell("B4").value = "交通費";
  ws.getCell("C4").value = 100;
  ws.getCell("D4").value = "2025-02-29";
  const [sheet] = await parseWorkbook(await wb.xlsx.writeBuffer() as ArrayBuffer);
  expect(sheet.rows[0]).toMatchObject({ amount: -3500, date: "2024-02-29" });
  expect(sheet.rows[1]).toMatchObject({ issue: { cell: "D4", reason: expect.stringContaining("日付") } });
});
