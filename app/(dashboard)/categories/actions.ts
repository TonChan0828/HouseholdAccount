"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireDashboardContext } from "@/lib/household";
import { categorySchema } from "@/lib/validations/category";

export type CategoryActionState = { error: string } | undefined;

function parse(formData: FormData) {
  return categorySchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color"),
    type: formData.get("type"),
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
    return { error: "カテゴリの更新に失敗しました" };
  }

  revalidatePath("/categories");
  redirect("/categories");
}

/** カスタムカテゴリを削除する。紐づく取引は on delete set null で未分類になる。 */
export async function deleteCategory(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return;
  }

  const { householdId, supabase } = await requireDashboardContext();
  await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("household_id", householdId)
    .eq("is_default", false);

  revalidatePath("/categories");
  redirect("/categories");
}
