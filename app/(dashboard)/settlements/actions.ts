"use server";

import { revalidatePath } from "next/cache";

import { requireDashboardContext } from "@/lib/household";
import { refFromParam, toISODate } from "@/lib/period";
import { throwIfError } from "@/lib/queries/result";

export type SettlementActionState = { error: string } | undefined;

/**
 * 当期を精算済みにする。実行時点の計算結果をスナップショットとして保存する。
 * 同一期間の二重精算は settlements の unique 制約（23505）で防ぐ。
 */
export async function createSettlement(
  _prevState: SettlementActionState,
  formData: FormData,
): Promise<SettlementActionState> {
  const ref = String(formData.get("ref") ?? "");
  const { householdId, supabase } = await requireDashboardContext();
  const reference = refFromParam(ref || undefined);
  if (!Number.isFinite(reference.getTime())) return { error: "対象期間が不正です" };
  const { data, error } = await supabase.rpc("create_settlement", {
    _household_id: householdId,
    _ref: toISODate(reference),
  });
  if (error) {
    if (error.code === "23505") return { error: "すでに精算済みです" };
    if (error.message === "settlement_members_required") return { error: "精算にはメンバーが2人以上必要です" };
    if (error.message === "settlement_no_expenses") return { error: "この期間に精算対象の支出はありません" };
    return { error: "精算の記録に失敗しました" };
  }
  if (typeof data !== "string") return { error: "精算の記録に失敗しました" };

  revalidatePath("/settlements");
  return undefined;
}

/** 精算を取り消す（RLS により実行者本人のみ削除できる。多層防御で household もスコープ）。 */
export async function deleteSettlement(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return;
  }

  const { householdId, supabase } = await requireDashboardContext();

  const result = await supabase
    .from("settlements")
    .delete()
    .eq("id", id)
    .eq("household_id", householdId);
  throwIfError(result, "deleteSettlement");

  revalidatePath("/settlements");
}
