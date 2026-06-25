"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getActiveHouseholdId } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";
import { recurringTransactionSchema } from "@/lib/validations/transaction";

export type RecurringActionState = { error: string } | undefined;

function parse(formData: FormData) {
  return recurringTransactionSchema.safeParse({
    type: formData.get("type"),
    amount: formData.get("amount"),
    category_id: formData.get("category_id"),
    memo: formData.get("memo"),
    is_active: formData.get("is_active"),
  });
}

/** 定期項目を新規登録する。登録後、当期分の収支を即時生成する。 */
export async function createRecurring(
  _prevState: RecurringActionState,
  formData: FormData,
): Promise<RecurringActionState> {
  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
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

  const { type, amount, category_id, memo, is_active } = parsed.data;
  const { error } = await supabase.from("recurring_transactions").insert({
    household_id: householdId,
    created_by: user.id,
    type,
    amount,
    category_id: category_id ?? null,
    memo: memo || null,
    is_active,
  });

  if (error) {
    return { error: "定期項目の登録に失敗しました" };
  }

  // 作成直後に当期分の収支を生成する（次期を待たずに反映する）。冪等なので失敗しても致命的ではない。
  await supabase.rpc("generate_due_recurring", { _household_id: householdId });

  revalidatePath("/transactions/recurring");
  revalidatePath("/transactions");
  redirect("/transactions/recurring");
}

/** 定期項目を編集する（RLS に加えてアクティブグループでもスコープする多層防御）。 */
export async function updateRecurring(
  _prevState: RecurringActionState,
  formData: FormData,
): Promise<RecurringActionState> {
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "対象が指定されていません" };
  }

  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
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

  const { type, amount, category_id, memo, is_active } = parsed.data;
  const { data, error } = await supabase
    .from("recurring_transactions")
    .update({
      type,
      amount,
      category_id: category_id ?? null,
      memo: memo || null,
      is_active,
    })
    .eq("id", id)
    .eq("household_id", householdId)
    .select("id");

  if (error) {
    return { error: "定期項目の更新に失敗しました" };
  }
  if (!data || data.length === 0) {
    return { error: "対象の定期項目が見つかりません" };
  }

  revalidatePath("/transactions/recurring");
  redirect("/transactions/recurring");
}

/** 定期項目を削除する。生成済みの収支は履歴として残る（recurring_id は set null）。 */
export async function deleteRecurring(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return;
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

  await supabase
    .from("recurring_transactions")
    .delete()
    .eq("id", id)
    .eq("household_id", householdId);

  revalidatePath("/transactions/recurring");
  redirect("/transactions/recurring");
}

/** 定期項目の有効/無効を切り替える（自動生成の一時停止）。 */
export async function toggleRecurringActive(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return;
  }
  const isActive = formData.get("is_active") === "true";

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

  await supabase
    .from("recurring_transactions")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("household_id", householdId);

  revalidatePath("/transactions/recurring");
}
