import type { ServerClient } from "@/lib/household";
import { toISODate } from "@/lib/period";

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
  category: { name: string; color: string | null } | null;
};

/**
 * 収支を household_id と [start, end) の期間でスコープして取得する。
 *
 * 並び順は既定で date・created_at の降順（一覧系）。カレンダーのように
 * 古い順に積み上げたい場合は `order: "asc"` を指定する。
 */
export async function fetchTransactionsInRange(
  supabase: ServerClient,
  householdId: string,
  range: { start: Date; end: Date },
  options?: { order?: "asc" | "desc" },
): Promise<TransactionRow[]> {
  const ascending = options?.order === "asc";
  const { data } = await supabase
    .from("transactions")
    .select(
      "id, amount, type, date, memo, created_by, category_id, recurring_id, category:categories(name, color)",
    )
    .eq("household_id", householdId)
    .gte("date", toISODate(range.start))
    .lt("date", toISODate(range.end))
    .order("date", { ascending })
    .order("created_at", { ascending })
    .overrideTypes<TransactionRow[]>();
  return data ?? [];
}
