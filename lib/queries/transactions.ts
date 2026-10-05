import type { ServerClient } from "@/lib/household";
import { toISODate } from "@/lib/period";
import { DataAccessError } from "@/lib/queries/errors";
import { escapeLike, type TransactionFilter } from "@/lib/transaction-filter";
import { cursorCondition, decodePageCursor, encodePageCursor } from "@/lib/transactions/page-cursor";
import { attributionOrFilter } from "@/lib/transactions/attribution";

const FETCH_BATCH_SIZE = 1000;
export const TRANSACTION_PAGE_SIZE = 50;

/**
 * 期間スコープ取得の共通行型。select カラムの最大集合で、
 * 呼び出し側は必要なフィールドだけ使う。
 */
export type TransactionRow = {
  id: string;
  created_at: string;
  amount: number;
  type: "income" | "expense";
  date: string;
  memo: string | null;
  created_by: string;
  /** 名義人（代理入力。spec 41）。null なら入力者本人が名義人。 */
  on_behalf_of: string | null;
  category_id: string | null;
  recurring_id: string | null;
  is_shared: boolean;
  category: { name: string; color: string | null; icon: string | null } | null;
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
  const rows: TransactionRow[] = [];

  for (let offset = 0; ; offset += FETCH_BATCH_SIZE) {
    const { data, error } = await buildTransactionQuery(
      supabase,
      householdId,
      range,
      filter,
      ascending,
    )
      .range(offset, offset + FETCH_BATCH_SIZE - 1)
      .overrideTypes<TransactionRow[]>();
    if (error) {
      throw new DataAccessError("fetchTransactionsInRange", error);
    }
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < FETCH_BATCH_SIZE) {
      return rows;
    }
  }
}

export type TransactionPage = {
  items: TransactionRow[];
  nextCursor: string | null;
  previousCursor: string | null;
};

/** 一覧表示用に50件ずつ、最後に表示した記録の値を基準に取得する。 */
export async function fetchTransactionPage(
  supabase: ServerClient,
  householdId: string,
  range: { start: Date; end: Date },
  options?: { cursor?: string; filter?: TransactionFilter },
): Promise<TransactionPage> {
  const cursor = decodePageCursor(options?.cursor);
  const backwards = cursor?.direction === "before";
  let query = buildTransactionQuery(supabase, householdId, range, options?.filter ?? {}, backwards);
  if (cursor) query = query.or(cursorCondition(cursor));
  const { data, error } = await query.limit(TRANSACTION_PAGE_SIZE + 1).overrideTypes<TransactionRow[]>();
  if (error) throw new DataAccessError("fetchTransactionPage", error);
  const rows = data ?? [];
  const hasMore = rows.length > TRANSACTION_PAGE_SIZE;
  const items = rows.slice(0, TRANSACTION_PAGE_SIZE);
  if (backwards) items.reverse();
  const first = items[0];
  const last = items.at(-1);
  if (!first && cursor) {
    return {
      items,
      previousCursor: backwards ? null : encodePageCursor(cursor, "before"),
      nextCursor: backwards ? encodePageCursor(cursor, "after") : null,
    };
  }
  return {
    items,
    nextCursor: last && (backwards || hasMore) ? encodePageCursor(last, "after") : null,
    previousCursor: first && (backwards ? hasMore : Boolean(cursor)) ? encodePageCursor(first, "before") : null,
  };
}

function buildTransactionQuery(
  supabase: ServerClient,
  householdId: string,
  range: { start: Date; end: Date },
  filter: TransactionFilter,
  ascending: boolean,
) {
  let query = supabase
    .from("transactions")
    .select(
      "id, created_at, amount, type, date, memo, created_by, on_behalf_of, category_id, recurring_id, is_shared, category:categories(name, color, icon)",
    )
    .eq("household_id", householdId)
    .gte("date", toISODate(range.start))
    .lt("date", toISODate(range.end));
  if (filter.type) query = query.eq("type", filter.type);
  if (filter.categoryId) query = query.eq("category_id", filter.categoryId);
  // メンバー絞り込みは帰属ユーザー（名義人。spec 41）基準。
  // coalesce(on_behalf_of, created_by) = 指定ユーザー を PostgREST の or 句で表す。
  if (filter.createdBy) query = query.or(attributionOrFilter(filter.createdBy));
  if (filter.memoQuery) {
    query = query.ilike("memo", `%${escapeLike(filter.memoQuery)}%`);
  }
  if (filter.minAmount !== undefined) query = query.gte("amount", filter.minAmount);
  if (filter.maxAmount !== undefined) query = query.lte("amount", filter.maxAmount);
  return query
    .order("date", { ascending })
    .order("created_at", { ascending })
    .order("id", { ascending });
}
