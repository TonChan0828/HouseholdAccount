import type { ServerClient } from "@/lib/household";
import { unwrapData } from "@/lib/queries/result";
import type { Category } from "@/types";

/**
 * 収支フォーム・ダイアログが必要とするカテゴリの最小集合。
 * `TransactionForm` は id/name/color/type しか使わないため、
 * ページ側は行全体を取らずこの形で受け渡す。
 */
export type CategoryOption = Pick<Category, "id" | "name" | "color" | "type"> & { is_hidden?: boolean };

/**
 * グループのカテゴリを、収支フォーム向けに type・保存順で取得する。
 *
 * 収支の登録・編集画面で同じクエリを重複して書いていたのを一箇所に集約する。
 * 取得失敗を空配列（＝カテゴリ0件）と誤認させないため、例外を投げる。
 */
export async function fetchHouseholdCategories(
  supabase: ServerClient,
  householdId: string,
): Promise<CategoryOption[]> {
  const result = await categoryOptionsQuery(supabase, householdId);
  return unwrapData(result, "fetchHouseholdCategories") ?? [];
}

function categoryOptionsQuery(supabase: ServerClient, householdId: string) {
  return supabase
    .from("categories")
    .select("id, name, color, type, is_hidden")
    .eq("household_id", householdId)
    .order("type", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
}

export async function fetchExpenseCategories(supabase: ServerClient, householdId: string) {
  const result = await categoryOptionsQuery(supabase, householdId).in("type", ["expense", "both"]);
  return unwrapData(result, "fetchExpenseCategories") ?? [];
}

export async function fetchManagedCategories(supabase: ServerClient, householdId: string) {
  const result = await supabase.from("categories").select("*").eq("household_id", householdId)
    .order("type", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  return unwrapData(result, "fetchManagedCategories") ?? [];
}

export async function fetchEditableCategory(supabase: ServerClient, householdId: string, id: string) {
  const result = await supabase.from("categories").select("*").eq("household_id", householdId)
    .eq("id", id).eq("is_default", false).maybeSingle();
  return unwrapData(result, "fetchEditableCategory");
}

export async function fetchReminderCategories(supabase: ServerClient, householdId: string) {
  const result = await supabase.from("categories").select("id, name").eq("household_id", householdId)
    .eq("reminder_enabled", true).eq("is_hidden", false);
  return unwrapData(result, "fetchReminderCategories") ?? [];
}
