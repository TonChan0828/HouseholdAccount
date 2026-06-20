"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  categoryKey,
  type ClassifyResult,
  classifyRows,
  type ExistingCategory,
  parseMonthFromFilename,
  splitCategoryNames,
  type ValidImportRow,
} from "@/lib/import/excel";
import { parseWorkbook } from "@/lib/import/parse-workbook";
import { getActiveHouseholdId } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_COLORS } from "@/lib/validations/category";

/** 取り込みの上限行数（過大ファイル対策）。 */
const MAX_ROWS = 500;

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
  const householdId = await getActiveHouseholdId();
  if (!householdId) {
    redirect("/households");
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "ファイルを選択してください" };
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
  month: z.string().regex(/^\d{4}-\d{2}$/, "対象月が不正です"),
  rows: z
    .array(
      z.object({
        type: z.enum(["income", "expense"]),
        categoryName: z.string().trim().min(1).max(50),
        amount: z.coerce.number().int().min(1),
      }),
    )
    .min(1, "取り込む収支がありません")
    .max(MAX_ROWS),
});

export type ImportConfirmState = { error: string } | undefined;

/**
 * プレビューで確定された有効行を取り込む。
 *
 * クライアントを信用せずサーバーで再検証し、不足カテゴリを自動作成してから一括 insert する。
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const householdId = await getActiveHouseholdId();
  if (!householdId) {
    redirect("/households");
  }

  const rows = parsed.rows as ValidImportRow[];
  const date = `${parsed.month}-01`;

  // 1) 既存カテゴリを取得し、不足分を自動作成して name×type → id の解決マップを作る。
  const { data: existing, error: catFetchError } = await supabase
    .from("categories")
    .select("id, name, type")
    .eq("household_id", householdId);
  if (catFetchError) {
    return { error: "カテゴリの取得に失敗しました" };
  }

  const needed = rows.map((r) => ({ name: r.categoryName, type: r.type }));
  const { matched, toCreate } = splitCategoryNames(
    (existing ?? []) as ExistingCategory[],
    needed,
  );

  const idByKey = new Map<string, string>();
  for (const m of matched) {
    idByKey.set(categoryKey(m.name, m.type), m.id);
  }

  if (toCreate.length > 0) {
    const { data: created, error: createError } = await supabase
      .from("categories")
      .insert(
        toCreate.map((c, i) => ({
          household_id: householdId,
          name: c.name,
          type: c.type,
          color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
          is_default: false,
        })),
      )
      .select("id, name, type");
    if (createError || !created) {
      return { error: "カテゴリの作成に失敗しました" };
    }
    for (const c of created) {
      idByKey.set(categoryKey(c.name, c.type as ValidImportRow["type"]), c.id);
    }
  }

  // 2) 取引を一括 insert（household_id / created_by を自動付与、日付は対象月の1日）。
  const { error: insertError } = await supabase.from("transactions").insert(
    rows.map((r) => ({
      household_id: householdId,
      created_by: user.id,
      type: r.type,
      amount: r.amount,
      date,
      category_id: idByKey.get(categoryKey(r.categoryName, r.type)) ?? null,
      memo: null,
    })),
  );
  if (insertError) {
    return { error: "収支の取り込みに失敗しました" };
  }

  revalidatePath("/transactions");
  redirect(`/transactions?ref=${date}`);
}
