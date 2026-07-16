import type { ServerClient } from "@/lib/household";
import { toISODate } from "@/lib/period";
import { DataAccessError } from "@/lib/queries/errors";
import { escapeLike, type TransactionFilter } from "@/lib/transaction-filter";

const FETCH_BATCH_SIZE = 1000;
export const TRANSACTION_PAGE_SIZE = 50;

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

/** 一覧表示用に50件ずつ取得する。cursor は先頭からの安全な数値offset。 */
export async function fetchTransactionPage(
  supabase: ServerClient,
  householdId: string,
  range: { start: Date; end: Date },
  options?: { cursor?: string; filter?: TransactionFilter },
): Promise<TransactionPage> {
  const offset = parseCursor(options?.cursor);
  const { data, error } = await buildTransactionQuery(
    supabase,
    householdId,
    range,
    options?.filter ?? {},
    false,
  )
    .range(offset, offset + TRANSACTION_PAGE_SIZE)
    .overrideTypes<TransactionRow[]>();
  if (error) {
    throw new DataAccessError("fetchTransactionPage", error);
  }

  const rows = data ?? [];
  const hasNext = rows.length > TRANSACTION_PAGE_SIZE;
  return {
    items: rows.slice(0, TRANSACTION_PAGE_SIZE),
    nextCursor: hasNext ? String(offset + TRANSACTION_PAGE_SIZE) : null,
    previousCursor:
      offset > 0 ? String(Math.max(0, offset - TRANSACTION_PAGE_SIZE)) : null,
  };
}

function parseCursor(cursor: string | undefined): number {
  if (!cursor || !/^\d+$/.test(cursor)) return 0;
  const value = Number(cursor);
  return Number.isSafeInteger(value) ? value : 0;
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
  if (filter.minAmount !== undefined) query = query.gte("amount", filter.minAmount);
  if (filter.maxAmount !== undefined) query = query.lte("amount", filter.maxAmount);
  return query
    .order("date", { ascending })
    .order("created_at", { ascending });
}
