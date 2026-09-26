"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  type ClassifyResult,
  classifyRows,
  parseMonthFromFilename,
  type ValidImportRow,
} from "@/lib/import/excel";
import { parseWorkbook } from "@/lib/import/parse-workbook";
import { requireDashboardContext } from "@/lib/household";

/** 取り込みの上限行数（過大ファイル対策）。 */
const MAX_ROWS = 500;

/** アップロードファイルのサイズ上限（過大ファイルによるメモリ消費対策）。 */
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/** 1シート分のプレビュー（シート名・推定対象月・分類結果）。 */
export type SheetPreview = { sheet: string; month: string; result: ClassifyResult };

export type ImportPreviewState =
  | { ok: true; sheets: SheetPreview[] }
  | { ok: false; error: string }
  | undefined;

/** 今月を `YYYY-MM` で返す（ファイル名から月を取れなかったときの初期値）。 */
function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * アップロードされた Excel をサーバーでパース・分類してプレビュー state を返す。
 *
 * 認可は household スコープに閉じ込める。パース結果は確定時に再検証するため、ここでは検証のみ。
 */
export async function parseImportFile(
  _prev: ImportPreviewState,
  formData: FormData,
): Promise<ImportPreviewState> {
  await requireDashboardContext();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "ファイルを選択してください" };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: "ファイルサイズが大きすぎます（5MB以内）" };
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { ok: false, error: "Excel ファイル（.xlsx）を選択してください" };
  }

  let sheets: SheetPreview[];
  try {
    const buffer = await file.arrayBuffer();
    const parsed = await parseWorkbook(buffer);
    if (parsed.length === 0) {
      return { ok: false, error: "取り込めるシートが見つかりませんでした" };
    }
    const totalRows = parsed.reduce((sum, s) => sum + s.rows.length, 0);
    if (totalRows > MAX_ROWS) {
      return { ok: false, error: `行数が多すぎます（${MAX_ROWS}行以内）` };
    }
    // 対象月はシート名（例「2026年07月」）→ファイル名 の順で推定する。
    sheets = parsed.map((s) => ({
      sheet: s.sheet,
      month:
        parseMonthFromFilename(s.sheet) ??
        parseMonthFromFilename(file.name) ??
        currentMonth(),
      result: classifyRows(s.rows),
    }));
  } catch {
    return { ok: false, error: "ファイルを読み込めませんでした。形式を確認してください" };
  }

  const hasContent = sheets.some(
    (s) => s.result.valid.length > 0 || s.result.errors.length > 0,
  );
  if (!hasContent) {
    return { ok: false, error: "取り込める収支が見つかりませんでした" };
  }

  return { ok: true, sheets };
}

const confirmSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "対象月が不正です"),
  rows: z
    .array(
      z.object({
        type: z.enum(["income", "expense"]),
        categoryName: z.string().trim().min(1).max(50),
        amount: z.coerce.number().int().min(1).max(2_147_483_647),
      }),
    )
    .min(1, "取り込む収支がありません")
    .max(MAX_ROWS),
});

export type ImportConfirmState = { error: string } | undefined;

/**
 * プレビューで確定された有効行を取り込む。
 *
 * クライアントを信用せずサーバーで再検証し、不足カテゴリを自動作成して一括 insert する。
 * 過去の Excel 取込と一致した行は RPC が二重登録を避け、件数を返す。
 */
export async function confirmImport(
  _prev: ImportConfirmState,
  formData: FormData,
): Promise<ImportConfirmState> {
  let parsed: z.infer<typeof confirmSchema>;
  try {
    parsed = confirmSchema.parse({
      month: formData.get("month"),
      rows: JSON.parse(String(formData.get("rows") ?? "[]")),
    });
  } catch {
    return { error: "取り込む内容を確認してください" };
  }

  const { householdId, supabase } = await requireDashboardContext();
  const rows = parsed.rows as ValidImportRow[];
  const { data: importedCount, error } = await supabase.rpc(
    "confirm_transaction_import",
    {
      _household_id: householdId,
      _month: `${parsed.month}-01`,
      _rows: rows,
    },
  );
  if (
    error ||
    typeof importedCount !== "number" ||
    !Number.isInteger(importedCount) ||
    importedCount < 0 ||
    importedCount > rows.length
  ) {
    return { error: "収支の取り込みに失敗しました" };
  }

  const date = `${parsed.month}-01`;
  const duplicateCount = rows.length - importedCount;
  revalidatePath("/transactions");
  redirect(
    `/transactions?ref=${date}&imported=${importedCount}&duplicates=${duplicateCount}`,
  );
}
