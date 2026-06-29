"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getActiveHouseholdId } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";
import { savingsGoalSchema } from "@/lib/validations/savings-goal";

export type SavingsGoalActionState = { error: string } | { ok: true } | undefined;

/** 貯金目標を設定（新規/更新）する。グループに1件で upsert する。 */
export async function upsertSavingsGoal(
  _prevState: SavingsGoalActionState,
  formData: FormData,
): Promise<SavingsGoalActionState> {
  const parsed = savingsGoalSchema.safeParse({
    name: formData.get("name"),
    target_amount: formData.get("target_amount"),
    start_date: formData.get("start_date"),
    target_date: formData.get("target_date"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const householdId = await getActiveHouseholdId();
  if (!householdId) {
    redirect("/households");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("savings_goals").upsert(
    {
      household_id: householdId,
      name: parsed.data.name,
      target_amount: parsed.data.target_amount,
      start_date: parsed.data.start_date,
      target_date: parsed.data.target_date,
    },
    { onConflict: "household_id" },
  );

  if (error) {
    return { error: "貯金目標の保存に失敗しました" };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}

/** 貯金目標を解除（削除）する。household_id でスコープする。 */
export async function deleteSavingsGoal(): Promise<void> {
  const householdId = await getActiveHouseholdId();
  if (!householdId) {
    redirect("/households");
  }

  const supabase = await createClient();
  await supabase.from("savings_goals").delete().eq("household_id", householdId);

  revalidatePath("/dashboard");
}
