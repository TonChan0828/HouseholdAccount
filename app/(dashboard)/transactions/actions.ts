"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getActiveHouseholdId } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";
import { transactionSchema } from "@/lib/validations/transaction";

export type TransactionActionState =
  | { error: string }
  | { ok: true; key: string }
  | undefined;

function parse(formData: FormData) {
  return transactionSchema.safeParse({
    type: formData.get("type"),
    amount: formData.get("amount"),
    date: formData.get("date"),
    category_id: formData.get("category_id"),
    memo: formData.get("memo"),
  });
}

/** 収支を新規登録する。登録者と household を自動付与。 */
export async function createTransaction(
  _prevState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
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

  const { type, amount, date, category_id, memo } = parsed.data;
  const { error } = await supabase.from("transactions").insert({
    household_id: householdId,
    created_by: user.id,
    type,
    amount,
    date,
    category_id: category_id ?? null,
    memo: memo || null,
  });

  if (error) {
    return { error: "収支の登録に失敗しました" };
  }

  revalidatePath("/transactions");

  // 「登録して続ける」場合はフォームに留まれるよう成功状態を返す。
  // key は連続成功のたびに変わり、クライアント側のフォームリセットを毎回トリガーする。
  if (formData.get("_continue") === "1") {
    return { ok: true, key: crypto.randomUUID() };
  }

  redirect("/transactions");
}

/** 収支を編集する（RLS に加えてアクティブグループでもスコープする多層防御）。 */
export async function updateTransaction(
  _prevState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
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

  const { type, amount, date, category_id, memo } = parsed.data;
  const { data, error } = await supabase
    .from("transactions")
    .update({
      type,
      amount,
      date,
      category_id: category_id ?? null,
      memo: memo || null,
    })
    .eq("id", id)
    .eq("household_id", householdId)
    .select("id");

  if (error) {
    return { error: "収支の更新に失敗しました" };
  }
  if (!data || data.length === 0) {
    return { error: "対象の収支が見つかりません" };
  }

  revalidatePath("/transactions");
  redirect("/transactions");
}

/** 収支を削除する（RLS に加えてアクティブグループでもスコープする多層防御）。 */
export async function deleteTransaction(formData: FormData): Promise<void> {
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
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("household_id", householdId);

  revalidatePath("/transactions");
  redirect("/transactions");
}
