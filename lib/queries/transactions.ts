import type { ServerClient } from "@/lib/household";
import { toISODate } from "@/lib/period";
import { escapeLike, type TransactionFilter } from "@/lib/transaction-filter";

/**
 * 期間スコープ取得の共通行型。select カラムの最大集合で、
 * 呼び出し側は必要なフィールドだけ使う。
 */
export type TransactionRow = {
  id: string;
  amount: number;
  type: "income" | "expense";
  date: string;
  memo: string | null;
  created_by: string;
  category_id: string | null;
  recurring_id: string | null;
  is_shared: boolean;
  category: { name: string; color: string | null } | null;
};

/**
 * 収支を household_id と [start, end) の期間でスコープして取得する。
 *
 * 並び順は既定で date・created_at の降順（一覧系）。カレンダーのように
 * 古い順に積み上げたい場合は `order: "asc"` を指定する。
 * `filter` は検証済みの条件（spec 36）を指定時のみ追加する。
 */
export async function fetchTransactionsInRange(
  supabase: ServerClient,
  householdId: string,
  range: { start: Date; end: Date },
  options?: { order?: "asc" | "desc"; filter?: TransactionFilter },
): Promise<TransactionRow[]> {
  const ascending = options?.order === "asc";
  const filter = options?.filter ?? {};
  let query = supabase
    .from("transactions")
    .select(
      "id, amount, type, date, memo, created_by, category_id, recurring_id, is_shared, category:categories(name, color)",
    )
    .eq("household_id", householdId)
    .gte("date", toISODate(range.start))
    .lt("date", toISODate(range.end));
  if (filter.type) query = query.eq("type", filter.type);
  if (filter.categoryId) query = query.eq("category_id", filter.categoryId);
  if (filter.createdBy) query = query.eq("created_by", filter.createdBy);
  if (filter.memoQuery) {
    query = query.ilike("memo", `%${escapeLike(filter.memoQuery)}%`);
  }
  if (filter.minAmount !== undefined) {
    query = query.gte("amount", filter.minAmount);
  }
  if (filter.maxAmount !== undefined) {
    query = query.lte("amount", filter.maxAmount);
  }
  const { data } = await query
    .order("date", { ascending })
    .order("created_at", { ascending })
    .overrideTypes<TransactionRow[]>();
  return data ?? [];
}
