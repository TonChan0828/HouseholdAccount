"use server";

import { revalidatePath } from "next/cache";

import {
  getHouseholdSettings,
  requireDashboardContext,
} from "@/lib/household";
import { getPeriodRange, refFromParam, toISODate } from "@/lib/period";
import { getHouseholdMemberNames } from "@/lib/queries/members";
import { fetchTransactionsInRange } from "@/lib/queries/transactions";
import { buildSettlement } from "@/lib/settlement";
import type { Json } from "@/types/database";

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

  const { user, householdId, supabase } = await requireDashboardContext();
  const { periodStartDay } = await getHouseholdSettings(householdId);
  const range = getPeriodRange(refFromParam(ref || undefined), periodStartDay);

  const [txs, members] = await Promise.all([
    fetchTransactionsInRange(supabase, householdId, range),
    getHouseholdMemberNames(householdId),
  ]);

  if (members.length < 2) {
    return { error: "精算にはメンバーが2人以上必要です" };
  }

  const result = buildSettlement(txs, members);
  if (result.total === 0) {
    return { error: "この期間に精算対象の支出はありません" };
  }

  const { error } = await supabase.from("settlements").insert({
    household_id: householdId,
    period_start: toISODate(range.start),
    settled_by: user.id,
    snapshot: result as unknown as Json,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "すでに精算済みです" };
    }
    return { error: "精算の記録に失敗しました" };
  }

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

  await supabase
    .from("settlements")
    .delete()
    .eq("id", id)
    .eq("household_id", householdId);

  revalidatePath("/settlements");
}
