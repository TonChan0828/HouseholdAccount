import type { ServerClient } from "@/lib/household";
import { toISODate } from "@/lib/period";
import { escapeLike, type TransactionFilter } from "@/lib/transaction-filter";
import { DataAccessError } from "./errors";

/** データベースで日計を集計し、期間内の明細を取得せず合計・件数も求める。 */
export async function fetchTransactionSummary(
  supabase: ServerClient,
  householdId: string,
  range: { start: Date; end: Date },
  filter: TransactionFilter = {},
) {
  const { data, error } = await supabase.rpc("transaction_daily_summary", {
    _household_id: householdId,
    _start: toISODate(range.start),
    _end: toISODate(range.end),
    _type: filter.type,
    _category_id: filter.categoryId,
    _member_id: filter.createdBy,
    _memo_pattern: filter.memoQuery ? `%${escapeLike(filter.memoQuery)}%` : undefined,
    _min_amount: filter.minAmount,
    _max_amount: filter.maxAmount,
  });
  if (error) throw new DataAccessError("fetchTransactionSummary", error);
  const dailyTotals = new Map<string, { income: number; expense: number }>();
  let income = 0;
  let expense = 0;
  let count = 0;
  for (const day of data ?? []) {
    dailyTotals.set(day.date, { income: day.income, expense: day.expense });
    income += day.income;
    expense += day.expense;
    count += day.count;
  }
  return { income, expense, count, dailyTotals };
}
