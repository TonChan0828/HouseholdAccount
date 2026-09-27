import type { ServerClient } from "@/lib/household";
import { DataAccessError } from "@/lib/queries/errors";
import type { Category } from "@/types";

/**
 * 収支フォーム・ダイアログが必要とするカテゴリの最小集合。
 * `TransactionForm` は id/name/color/type しか使わないため、
 * ページ側は行全体を取らずこの形で受け渡す。
 */
export type CategoryOption = Pick<Category, "id" | "name" | "color" | "type">;

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
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, color, type")
    .eq("household_id", householdId)
    .order("type", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new DataAccessError("fetchHouseholdCategories", error);
  }
  return (data ?? []) as CategoryOption[];
}
