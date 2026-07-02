"use server";

import { revalidatePath } from "next/cache";

import { requireDashboardContext } from "@/lib/household";
import { budgetSchema } from "@/lib/validations/budget";

export type BudgetActionState = { error: string } | undefined;

/** カテゴリの予算を設定（新規/更新）する。予算は1カテゴリ1件で upsert する。 */
export async function upsertBudget(
  _prevState: BudgetActionState,
  formData: FormData,
): Promise<BudgetActionState> {
  const parsed = budgetSchema.safeParse({
    category_id: formData.get("category_id"),
    amount: formData.get("amount"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const { householdId, supabase } = await requireDashboardContext();
  const { error } = await supabase.from("budgets").upsert(
    {
      household_id: householdId,
      category_id: parsed.data.category_id,
      amount: parsed.data.amount,
    },
    { onConflict: "household_id,category_id" },
  );

  if (error) {
    return { error: "予算の保存に失敗しました" };
  }

  revalidatePath("/budgets");
  revalidatePath("/dashboard");
  return undefined;
}

/** カテゴリの予算を解除（削除）する。category_id ＋ household_id でスコープする。 */
export async function deleteBudget(formData: FormData): Promise<void> {
  const categoryId = String(formData.get("category_id") ?? "");
  if (!categoryId) {
    return;
  }

  const { householdId, supabase } = await requireDashboardContext();
  await supabase
    .from("budgets")
    .delete()
    .eq("category_id", categoryId)
    .eq("household_id", householdId);

  revalidatePath("/budgets");
  revalidatePath("/dashboard");
}
