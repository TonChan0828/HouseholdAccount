import ExcelJS from "exceljs";

import type { BudgetRow } from "@/lib/import/excel";

/** 数式・各種セル値から金額（数値）を取り出す。空なら null。 */
function cellToAmount(value: ExcelJS.CellValue | undefined): number | null {
  if (value == null || value === "") {
    return null;
  }
  // 数式セルは { formula, result } 形式。result を採用する。
  if (typeof value === "object" && "result" in value) {
    return cellToAmount((value as { result?: ExcelJS.CellValue }).result);
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    // 半角¥(U+00A5)・全角￥(U+FFE5)・「円」・カンマ・空白を除去してから数値化する。
    const n = Number(value.replace(/[,¥￥円\s]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** セル値を表示用テキストにする（項目名・見出し判定用）。 */
function cellToText(value: ExcelJS.CellValue | undefined): string {
  if (value == null) {
    return "";
  }
  if (typeof value === "object") {
    // 数式セルは { formula, result } 形式。result を採用する。
    if ("result" in value) {
      return cellToText((value as { result?: ExcelJS.CellValue }).result);
    }
    // リッチテキストセルは { richText: [{ text }, ...] }。各断片を連結する。
    if ("richText" in value) {
      return (value as { richText: { text: string }[] }).richText
        .map((r) => r.text)
        .join("")
        .trim();
    }
    // ハイパーリンクセルは { text, hyperlink }。表示テキストを使う。
    if ("text" in value) {
      return String((value as { text: unknown }).text).trim();
    }
  }
  return String(value).trim();
}

/** 1枚のテンプレシートの抽出結果（費目行 + そのシートがテンプレ構造を含むか）。 */
export type SheetParse = { sheet: string; rows: BudgetRow[] };

/**
 * 1シートを走査して費目行を抽出する。
 *
 * B列（項目）でセクション見出しを検出して収入/支出を切り替え、項目行は B列=項目名・C列=金額で読む。
 * 右側のサマリー列（E〜G）や「項目」見出し行・合計行は対象外。
 * `matched` は収入/支出いずれかの見出しを検出したか（=テンプレ構造を含むシートか）。
 */
function extractSheet(ws: ExcelJS.Worksheet): { matched: boolean; rows: BudgetRow[] } {
  const rows: BudgetRow[] = [];
  let section: "income" | "expense" | null = null;
  let matched = false;

  ws.eachRow((excelRow, rowNumber) => {
    const itemText = cellToText(excelRow.getCell(2).value); // B列

    // セクション見出しの検出（「1 か月の収入」「1 か月の支出」）。
    if (/か月の収入/.test(itemText)) {
      section = "income";
      matched = true;
      return;
    }
    if (/か月の支出/.test(itemText)) {
      section = "expense";
      matched = true;
      return;
    }

    if (section == null) {
      return;
    }
    // 見出し・空セルは項目ではない。
    if (itemText === "" || itemText === "項目" || itemText === "金額") {
      return;
    }

    rows.push({
      section,
      item: itemText,
      amount: cellToAmount(excelRow.getCell(3).value), // C列
      rowNumber,
    });
  });

  return { matched, rows };
}

/**
 * ブック内の「月々の収支（簡易版）」テンプレートに一致する全シートを抽出する。
 *
 * 先頭固定ではなくテンプレ見出しの有無で判定し、空・非対象シート（例: 空の Sheet1）は除外する。
 * 月ごとにシートが分かれたブックは複数件返り、UI 側でシートを選択する。シート順は保持する。
 *
 * exceljs に依存するためサーバー専用。Server Action（`"use server"`）からのみ import し、
 * クライアントバンドルには載せない（クライアント用の純関数は `excel.ts` 側に置く）。
 */
export async function parseWorkbook(buffer: ArrayBuffer): Promise<SheetParse[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const sheets: SheetParse[] = [];
  for (const ws of wb.worksheets) {
    const { matched, rows } = extractSheet(ws);
    if (matched) {
      sheets.push({ sheet: ws.name, rows });
    }
  }
  return sheets;
}
