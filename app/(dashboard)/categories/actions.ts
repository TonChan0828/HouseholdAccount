"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireDashboardContext } from "@/lib/household";
import { throwIfError } from "@/lib/queries/result";
import { categorySchema } from "@/lib/validations/category";

export type CategoryActionState = { error: string } | undefined;

const categoryOrderSchema = z.object({
  type: z.enum(["income", "expense", "both"]),
  categoryIds: z.array(z.uuid()),
});

function parse(formData: FormData) {
  return categorySchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color"),
    type: formData.get("type"),
    icon: String(formData.get("icon") ?? "") || null,
  });
}

/** カスタムカテゴリを追加する。 */
export async function createCategory(
  _prevState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const { householdId, supabase } = await requireDashboardContext();
  const { error } = await supabase.from("categories").insert({
    household_id: householdId,
    ...parsed.data,
    is_default: false,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "同じ種別のカテゴリに同じ名前が既にあります" };
    }
    return { error: "カテゴリの追加に失敗しました" };
  }

  revalidatePath("/categories");
  redirect("/categories");
}

/** カスタムカテゴリを編集する。デフォルトカテゴリは対象外（is_default=false 条件）。 */
export async function updateCategory(
  _prevState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "対象が指定されていません" };
  }

  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const { householdId, supabase } = await requireDashboardContext();
  const { error } = await supabase
    .from("categories")
    .update(parsed.data)
    .eq("id", id)
    .eq("household_id", householdId)
    .eq("is_default", false);

  if (error) {
    if (error.code === "23505") {
      return { error: "同じ種別のカテゴリに同じ名前が既にあります" };
    }
    return { error: "カテゴリの更新に失敗しました" };
  }

  revalidatePath("/categories");
  redirect("/categories");
}

/**
 * カテゴリの登録漏れ通知（reminder_enabled）を切り替える。
 * デフォルト・カスタム問わず対象（is_default による制限なし）。
 */
export async function toggleCategoryReminder(
  formData: FormData,
): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return;
  }
  const reminderEnabled = formData.get("reminder_enabled") === "true";

  const { householdId, supabase } = await requireDashboardContext();
  const result = await supabase
    .from("categories")
    .update({ reminder_enabled: reminderEnabled })
    .eq("id", id)
    .eq("household_id", householdId);
  throwIfError(result, "toggleCategoryReminder");

  revalidatePath("/categories");
}

/** カテゴリ種別内の並び順を、DBで全件検証して原子的に保存する。 */
export async function reorderCategories(formData: FormData): Promise<void> {
  const rawCategoryIds = formData.get("category_ids");
  let categoryIds: unknown;
  try {
    categoryIds =
      typeof rawCategoryIds === "string" ? JSON.parse(rawCategoryIds) : null;
  } catch {
    categoryIds = null;
  }

  const parsed = categoryOrderSchema.safeParse({
    type: formData.get("type"),
    categoryIds,
  });
  if (!parsed.success) {
    redirect("/categories?sortError=invalid");
  }

  const { householdId, supabase } = await requireDashboardContext();
  const { error } = await supabase.rpc("reorder_categories", {
    _household_id: householdId,
    _type: parsed.data.type,
    _category_ids: parsed.data.categoryIds,
  });

  if (error) {
    // Concurrently changed lists are rejected by the RPC instead of applying a
    // partial order. Reload with a neutral message so the latest order is shown.
    revalidatePath("/categories");
    redirect("/categories?sortError=conflict");
  }

  revalidatePath("/categories");
}

/** カスタムカテゴリを削除する。紐づく取引は on delete set null で未分類になる。 */
export async function deleteCategory(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return;
  }

  const { householdId, supabase } = await requireDashboardContext();
  const result = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("household_id", householdId)
    .eq("is_default", false);
  throwIfError(result, "deleteCategory");

  revalidatePath("/categories");
  redirect("/categories");
}
