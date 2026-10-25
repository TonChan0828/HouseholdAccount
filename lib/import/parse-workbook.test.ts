import ExcelJS from "exceljs";
import JSZip from "jszip";
import { expect, it } from "vitest";
import { parseWorkbook, WORKBOOK_LIMITS } from "./parse-workbook";

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

it("通常のブックと文字数上限ちょうどのセルを読み込める", async () => {
  expect((await parseWorkbook(await workbook()))[0].rows[0]).toMatchObject({ item: "食費", amount: 100 });
  expect((await parseWorkbook(await workbook("a".repeat(WORKBOOK_LIMITS.cellCharacters))))[0].rows[0].item).toHaveLength(WORKBOOK_LIMITS.cellCharacters);
});
it("小さく圧縮された巨大セルを拒否する", async () => {
  const buffer = await workbook("a".repeat(8 * 1024 * 1024));
  expect(buffer.byteLength).toBeLessThan(100_000);
  await expect(parseWorkbook(buffer)).rejects.toThrow("InvalidWorkbook");
});
it("展開後のエントリー上限を超える圧縮データを拒否する", async () => {
  const buffer = await alter((zip) => { zip.file("large.bin", Buffer.alloc(WORKBOOK_LIMITS.entryBytes + 1)); });
  await expect(parseWorkbook(buffer)).rejects.toThrow("InvalidWorkbook");
});
it("エントリー数を制限する", async () => {
  const buffer = await alter((zip) => {
    for (let i = 0; i < WORKBOOK_LIMITS.entries + 1; i++) zip.file("extra" + i, "");
  });
  await expect(parseWorkbook(buffer)).rejects.toThrow("InvalidWorkbook");
});
it("複数の小さなエントリーでも展開後の合計を制限する", async () => {
  const buffer = await alter((zip) => {
    for (let i = 0; i < 3; i++) zip.file("payload" + i + ".bin", Buffer.alloc(6 * 1024 * 1024));
  });
  await expect(parseWorkbook(buffer)).rejects.toThrow("InvalidWorkbook");
});
it("シート数の上限を超えるブックを拒否する", async () => {
  const wb = new ExcelJS.Workbook();
  for (let i = 0; i <= WORKBOOK_LIMITS.sheets; i++) wb.addWorksheet("sheet" + i);
  await expect(parseWorkbook(await wb.xlsx.writeBuffer() as ArrayBuffer)).rejects.toThrow("InvalidWorkbook");
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
  await expect(parseWorkbook(await alter(edit))).rejects.toThrow("InvalidWorkbook");
});
it("解析が完了しなくてもスレッドを期限で終了する", async () => {
  await expect(parseWorkbook(await workbook(), 1)).rejects.toThrow("WorkbookTimeout");
});
