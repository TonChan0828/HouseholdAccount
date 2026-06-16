/**
 * 収支データの CSV エクスポート（純関数）。
 *
 * Excel での文字化けを避けるため先頭に UTF-8 BOM を付ける。
 * 値のエスケープは RFC4180 準拠（`,` `"` 改行 を含むときだけクオートし、内部の `"` は `""` に二重化）。
 */

export type ExportRow = {
  date: string;
  type: "income" | "expense";
  categoryName: string | null;
  amount: number;
  memo: string | null;
  memberName: string | null;
};

/** UTF-8 BOM。Excel が CSV を UTF-8 と判定し日本語が文字化けしないようにする。 */
const BOM = "﻿";

const HEADER = ["日付", "種別", "カテゴリ", "金額", "メモ", "登録者"];

/** RFC4180: `,` `"` 改行 を含む場合のみクオートし、内部の `"` は二重化する。 */
function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsvLine(fields: string[]): string {
  return fields.map(escapeCsvField).join(",");
}

/** 収支行を CSV 文字列（BOM + ヘッダー + データ行）に変換する。 */
export function toTransactionsCsv(rows: ExportRow[]): string {
  const lines = [toCsvLine(HEADER)];
  for (const r of rows) {
    lines.push(
      toCsvLine([
        r.date,
        r.type === "income" ? "収入" : "支出",
        r.categoryName ?? "未分類",
        String(r.amount),
        r.memo ?? "",
        r.memberName ?? "不明",
      ]),
    );
  }
  return BOM + lines.join("\n");
}
