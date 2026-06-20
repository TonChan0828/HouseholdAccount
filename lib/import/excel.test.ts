import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import {
  type BudgetRow,
  classifyRows,
  parseMonthFromFilename,
  splitCategoryNames,
} from "@/lib/import/excel";
import { parseWorkbook } from "@/lib/import/parse-workbook";

function row(overrides: Partial<BudgetRow> = {}): BudgetRow {
  return {
    section: "expense",
    item: "食費",
    amount: 1200,
    rowNumber: 14,
    ...overrides,
  };
}

describe("parseMonthFromFilename", () => {
  it("「YYYY年MM月」を YYYY-MM に変換する", () => {
    expect(parseMonthFromFilename("2026年06月家計簿.xlsx")).toBe("2026-06");
  });

  it("1桁の月はゼロ埋めする", () => {
    expect(parseMonthFromFilename("2026年6月.xlsx")).toBe("2026-06");
  });

  it("年月を含まない場合は null", () => {
    expect(parseMonthFromFilename("budget.xlsx")).toBeNull();
  });

  it("月が範囲外（13月・0月）の場合は null", () => {
    expect(parseMonthFromFilename("2026年13月.xlsx")).toBeNull();
    expect(parseMonthFromFilename("2026年0月.xlsx")).toBeNull();
  });
});

describe("classifyRows", () => {
  it("金額のある行は種別をセクションから決めて有効行にする", () => {
    const result = classifyRows([
      row({ section: "income", item: "給料", amount: 316719 }),
      row({ section: "expense", item: "食費", amount: 24224 }),
    ]);
    expect(result.valid).toEqual([
      { type: "income", categoryName: "給料", amount: 316719 },
      { type: "expense", categoryName: "食費", amount: 24224 },
    ]);
    expect(result.errors).toHaveLength(0);
  });

  it("金額が空（null）の行はスキップする（エラーにしない）", () => {
    const result = classifyRows([row({ item: "イオンカード", amount: null })]);
    expect(result.valid).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    expect(result.skipped).toEqual([
      { row: 14, item: "イオンカード", reason: "金額が空" },
    ]);
  });

  it("金額0はスキップする", () => {
    const result = classifyRows([row({ amount: 0 })]);
    expect(result.skipped).toHaveLength(1);
    expect(result.valid).toHaveLength(0);
  });

  it("金額が整数でない行はエラーにする", () => {
    const result = classifyRows([row({ amount: 1200.5 })]);
    expect(result.valid).toHaveLength(0);
    expect(result.errors[0]).toMatchObject({ row: 14, item: "食費" });
    expect(result.errors[0].reason).toContain("整数");
  });

  it("金額が負の行はエラーにする", () => {
    const result = classifyRows([row({ amount: -100 })]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toContain("1円以上");
  });

  it("項目名が空で金額がある行はエラーにする", () => {
    const result = classifyRows([row({ item: "   ", amount: 500 })]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toContain("項目名");
  });

  it("項目名が50文字超の行はエラーにする", () => {
    const result = classifyRows([row({ item: "あ".repeat(51) })]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toContain("長すぎ");
  });

  it("項目名の前後空白は除去して取り込む", () => {
    const result = classifyRows([row({ item: "  食費  ", amount: 100 })]);
    expect(result.valid[0].categoryName).toBe("食費");
  });
});

describe("splitCategoryNames", () => {
  it("名前と種別が一致する既存カテゴリにマッチさせる（ケース非依存）", () => {
    const { matched, toCreate } = splitCategoryNames(
      [{ id: "c1", name: "食費", type: "expense" }],
      [{ name: "食費", type: "expense" }],
    );
    expect(matched).toEqual([{ name: "食費", type: "expense", id: "c1" }]);
    expect(toCreate).toHaveLength(0);
  });

  it("type が both の既存カテゴリは収入・支出どちらにも一致する", () => {
    const { matched, toCreate } = splitCategoryNames(
      [{ id: "c2", name: "雑費", type: "both" }],
      [{ name: "雑費", type: "income" }],
    );
    expect(matched[0].id).toBe("c2");
    expect(toCreate).toHaveLength(0);
  });

  it("一致しない費目は新規作成対象になる", () => {
    const { matched, toCreate } = splitCategoryNames(
      [{ id: "c1", name: "食費", type: "expense" }],
      [{ name: "積み立てNISA", type: "expense" }],
    );
    expect(matched).toHaveLength(0);
    expect(toCreate).toEqual([{ name: "積み立てNISA", type: "expense" }]);
  });

  it("名前が同じでも種別が違えば新規作成対象になる", () => {
    const { toCreate } = splitCategoryNames(
      [{ id: "c1", name: "給料", type: "expense" }],
      [{ name: "給料", type: "income" }],
    );
    expect(toCreate).toEqual([{ name: "給料", type: "income" }]);
  });

  it("needed の重複は1つにまとめる", () => {
    const { toCreate } = splitCategoryNames(
      [],
      [
        { name: "娯楽", type: "expense" },
        { name: "娯楽", type: "expense" },
      ],
    );
    expect(toCreate).toHaveLength(1);
  });
});

describe("parseWorkbook", () => {
  /** テンプレと同じセクション構造のシートをブックに追加する。 */
  function addBudgetSheet(wb: ExcelJS.Workbook, name: string) {
    const ws = wb.addWorksheet(name);
    ws.getCell("B4").value = "1 か月の収入";
    ws.getCell("E4").value = "収入における支出の割合"; // 右側サマリー（無視対象）
    ws.getCell("B6").value = "項目";
    ws.getCell("C6").value = "金額";
    ws.getCell("B7").value = "給料";
    ws.getCell("C7").value = { formula: "290909+25810", result: 316719 } as ExcelJS.CellValue;
    ws.getCell("B8").value = "ボーナス";
    ws.getCell("C8").value = 72956;
    ws.getCell("E9").value = "1 か月の収入合計"; // サマリー（無視）
    ws.getCell("B12").value = "1 か月の支出";
    ws.getCell("B13").value = "項目";
    ws.getCell("C13").value = "金額";
    ws.getCell("B14").value = "食費";
    ws.getCell("C14").value = 24224;
    ws.getCell("B15").value = "イオンカード"; // 金額なし
    ws.getCell("B16").value = "服";
    ws.getCell("C16").value = { formula: "", result: "" } as ExcelJS.CellValue; // 空の数式
    return ws;
  }

  /** テンプレシート + 空の Sheet1（非対象）を持つブックの buffer。 */
  async function buildBuffer(): Promise<ArrayBuffer> {
    const wb = new ExcelJS.Workbook();
    addBudgetSheet(wb, "月々の収支 (簡易版)");
    wb.addWorksheet("Sheet1"); // 空シート（取り込み対象外）
    const buf = await wb.xlsx.writeBuffer();
    return buf as ArrayBuffer;
  }

  it("テンプレ一致シートのみを返し、空・非対象シートは除外する", async () => {
    const sheets = await parseWorkbook(await buildBuffer());
    expect(sheets).toHaveLength(1);
    expect(sheets[0].sheet).toBe("月々の収支 (簡易版)");
  });

  it("収入・支出セクションの項目/金額を抽出する", async () => {
    const [{ rows }] = await parseWorkbook(await buildBuffer());
    const byItem = Object.fromEntries(rows.map((r) => [r.item, r]));
    expect(byItem["給料"]).toMatchObject({ section: "income", amount: 316719 });
    expect(byItem["ボーナス"]).toMatchObject({ section: "income", amount: 72956 });
    expect(byItem["食費"]).toMatchObject({ section: "expense", amount: 24224 });
  });

  it("数式セルは計算結果を金額に採用する", async () => {
    const [{ rows }] = await parseWorkbook(await buildBuffer());
    expect(rows.find((r) => r.item === "給料")?.amount).toBe(316719);
  });

  it("金額が空（空数式含む）の費目は amount=null で返す", async () => {
    const [{ rows }] = await parseWorkbook(await buildBuffer());
    expect(rows.find((r) => r.item === "イオンカード")?.amount).toBeNull();
    expect(rows.find((r) => r.item === "服")?.amount).toBeNull();
  });

  it("「項目」見出し行と右側サマリー列は取り込まない", async () => {
    const [{ rows }] = await parseWorkbook(await buildBuffer());
    expect(rows.some((r) => r.item === "項目")).toBe(false);
    expect(rows.some((r) => r.item.includes("割合"))).toBe(false);
    expect(rows.some((r) => r.item.includes("合計"))).toBe(false);
  });

  it("リッチテキストの項目名と全角￥付き文字列の金額を正しく解釈する", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("月々の収支 (簡易版)");
    ws.getCell("B12").value = "1 か月の支出";
    ws.getCell("B13").value = "項目";
    ws.getCell("C13").value = "金額";
    // 項目名がリッチテキスト（太字断片を含む）
    ws.getCell("B14").value = {
      richText: [{ text: "食" }, { text: "費" }],
    } as ExcelJS.CellValue;
    // 金額が全角￥付きの文字列
    ws.getCell("C14").value = "￥24,224";
    const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;

    const [{ rows }] = await parseWorkbook(buf);
    expect(rows[0]).toMatchObject({ item: "食費", amount: 24224 });
  });

  it("テンプレ一致シートが複数あればシート名つきで全て返す（順序保持）", async () => {
    const wb = new ExcelJS.Workbook();
    addBudgetSheet(wb, "2026年06月");
    wb.addWorksheet("メモ"); // 非対象
    addBudgetSheet(wb, "2026年07月");
    const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;

    const sheets = await parseWorkbook(buf);
    expect(sheets.map((s) => s.sheet)).toEqual(["2026年06月", "2026年07月"]);
    expect(sheets[0].rows.length).toBeGreaterThan(0);
  });
});
