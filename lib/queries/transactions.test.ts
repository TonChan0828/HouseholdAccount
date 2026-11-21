import { beforeEach, describe, expect, it, vi } from "vitest";

import { decodePageCursor, encodePageCursor, cursorCondition } from "@/lib/transactions/page-cursor";
import { DataAccessError } from "./errors";
import { fetchTransactionPage, fetchTransactionsInRange } from "./transactions";

type OrderCall = { column: string; ascending: boolean };

const state = vi.hoisted(() => ({
  data: null as unknown[] | null,
  cap: Infinity,
  error: null as { message: string } | null,
  range: [0, 999] as [number, number],
  ranges: [] as [number, number][],
  captured: {
    table: "",
    select: "",
    filters: {} as Record<string, string | number>,
    orders: [] as OrderCall[],
  },
}));

function makeClient() {
  let cursor: ReturnType<typeof decodePageCursor> = null;
  let ascending = false;
  let limit = Infinity;
  const query = {
    select: (columns: string) => {
      state.captured.select = columns;
      return query;
    },
    eq: (column: string, value: string | number) => {
      state.captured.filters[`eq:${column}`] = value;
      return query;
    },
    gte: (column: string, value: string | number) => {
      state.captured.filters[`gte:${column}`] = value;
      return query;
    },
    lt: (column: string, value: string | number) => {
      state.captured.filters[`lt:${column}`] = value;
      return query;
    },
    lte: (column: string, value: string | number) => {
      state.captured.filters[`lte:${column}`] = value;
      return query;
    },
    ilike: (column: string, pattern: string) => {
      state.captured.filters[`ilike:${column}`] = pattern;
      return query;
    },
    or: (filters: string) => {
      state.captured.filters["or"] = filters;
      const parts = /date\.(lt|gt)\.([\d-]+).*created_at\.eq\.([^,]+),id\.(?:lt|gt)\.([0-9a-f-]+)/.exec(filters);
      if (parts) cursor = { direction: parts[1] === "lt" ? "after" : "before", date: parts[2], created_at: parts[3], id: parts[4] };
      return query;
    },
    limit: (count: number) => { limit = count; return query; },
    order: (column: string, opts?: { ascending?: boolean }) => {
      ascending = opts?.ascending ?? false;
      state.captured.orders.push({
        column,
        ascending: opts?.ascending ?? true,
      });
      return query;
    },
    range: (from: number, to: number) => {
      state.range = [from, to];
      state.ranges.push([from, to]);
      return query;
    },
    overrideTypes: () => {
      let rows = state.data;
      if (limit !== Infinity && rows) {
        const compare = (a: unknown, b: unknown) => {
          const left = a as { date: string; created_at: string; id: string };
          const right = b as typeof left;
          return left.date.localeCompare(right.date) || left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id);
        };
        rows = rows.filter((row) => !cursor || (cursor.direction === "after" ? compare(row, cursor) < 0 : compare(row, cursor) > 0));
        rows = [...rows].sort((a, b) => compare(a, b) * (ascending ? 1 : -1)).slice(0, limit);
      } else rows = rows?.slice(state.range[0], Math.min(state.range[1] + 1, state.range[0] + state.cap)) ?? null;
      return Promise.resolve({ data: rows, count: state.data?.length ?? 0, error: state.error });
    },
  };
  return {
    from: (table: string) => {
      state.captured.table = table;
      return query;
    },
  };
}

beforeEach(() => {
  state.data = [];
  state.cap = Infinity;
  state.error = null;
  state.range = [0, 999];
  state.ranges = [];
  state.captured = { table: "", select: "", filters: {}, orders: [] };
});

const range = {
  start: new Date("2026-07-01T00:00:00Z"),
  end: new Date("2026-08-01T00:00:00Z"),
};

const MEMBER_ID = "22222222-2222-4222-8222-222222222222";

describe("fetchTransactionsInRange", () => {
  it("household_id と [start, end) でスコープする", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await fetchTransactionsInRange(makeClient() as any, "h-1", range);

    expect(state.captured.table).toBe("transactions");
    expect(state.captured.filters).toEqual({
      "eq:household_id": "h-1",
      "gte:date": "2026-07-01",
      "lt:date": "2026-08-01",
    });
    expect(state.captured.select).toContain("category:categories(name, color, icon)");
    expect(state.captured.select).toContain("is_shared");
  });

  it("既定では date・created_at の降順で並べる", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await fetchTransactionsInRange(makeClient() as any, "h-1", range);

    expect(state.captured.orders).toEqual([
      { column: "date", ascending: false },
      { column: "created_at", ascending: false },
      { column: "id", ascending: false },
    ]);
  });

  it("order: asc 指定で昇順に並べる（カレンダー用）", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await fetchTransactionsInRange(makeClient() as any, "h-1", range, {
      order: "asc",
    });

    expect(state.captured.orders).toEqual([
      { column: "date", ascending: true },
      { column: "created_at", ascending: true },
      { column: "id", ascending: true },
    ]);
  });

  it("filter の各条件を指定時のみクエリに追加する（spec 36）", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await fetchTransactionsInRange(makeClient() as any, "h-1", range, {
      filter: {
        type: "expense",
        categoryId: "cat-1",
        createdBy: MEMBER_ID,
        minAmount: 100,
        maxAmount: 5000,
      },
    });

    expect(state.captured.filters).toEqual({
      "eq:household_id": "h-1",
      "gte:date": "2026-07-01",
      "lt:date": "2026-08-01",
      "eq:type": "expense",
      "eq:category_id": "cat-1",
      or: `on_behalf_of.eq.${MEMBER_ID},and(on_behalf_of.is.null,created_by.eq.${MEMBER_ID})`,
      "gte:amount": 100,
      "lte:amount": 5000,
    });
  });

  it("メンバー絞り込みは名義人基準の or 句にする（spec 41）", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await fetchTransactionsInRange(makeClient() as any, "h-1", range, {
      filter: { createdBy: MEMBER_ID },
    });

    // coalesce(on_behalf_of, created_by) = MEMBER_ID 相当。created_by の完全一致では絞らない。
    expect(state.captured.filters["or"]).toBe(
      `on_behalf_of.eq.${MEMBER_ID},and(on_behalf_of.is.null,created_by.eq.${MEMBER_ID})`,
    );
    expect(state.captured.filters["eq:created_by"]).toBeUndefined();
  });

  it("select に on_behalf_of を含める（spec 41）", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await fetchTransactionsInRange(makeClient() as any, "h-1", range);

    expect(state.captured.select).toContain("on_behalf_of");
  });

  it("memoQuery は LIKE 特殊文字をエスケープして部分一致検索する", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await fetchTransactionsInRange(makeClient() as any, "h-1", range, {
      filter: { memoQuery: "100%引_き" },
    });

    expect(state.captured.filters["ilike:memo"]).toBe("%100\\%引\\_き%");
  });

  it("空の filter では余計な条件を追加しない", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await fetchTransactionsInRange(makeClient() as any, "h-1", range, {
      filter: {},
    });

    expect(state.captured.filters).toEqual({
      "eq:household_id": "h-1",
      "gte:date": "2026-07-01",
      "lt:date": "2026-08-01",
    });
  });

  it("結果が null の場合は空配列を返す", async () => {
    state.data = null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await fetchTransactionsInRange(makeClient() as any, "h-1", range);

    expect(rows).toEqual([]);
  });

  it("1回の上限を超えた場合は次の範囲も取得する", async () => {
    state.data = Array.from({ length: 1001 }, (_, id) => ({ id }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await fetchTransactionsInRange(makeClient() as any, "h-1", range);

    expect(rows).toHaveLength(1001);
    expect(state.ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it("DBの取得上限が要求ページより小さくても全件取得する", async () => {
    state.data = [{ id: 1 }, { id: 2 }, { id: 3 }];
    state.cap = 2;
    const rows = await fetchTransactionsInRange(makeClient() as never, "h-1", range);
    expect(rows).toEqual(state.data);
  });

  it("Supabaseエラーを空配列にせず送出する", async () => {
    state.error = { message: "connection failed" };

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetchTransactionsInRange(makeClient() as any, "h-1", range),
    ).rejects.toBeInstanceOf(DataAccessError);
  });
});

const pageRow = (n: number) => ({
  id: `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`,
  date: "2026-07-10",
  created_at: "2026-07-10T12:00:00.123456+00:00",
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pageClient = () => makeClient() as any;

describe("fetchTransactionPage", () => {
  it("同じ日付・作成日時でもIDで区切り、追加・削除後も次のページを重複させない", async () => {
    state.data = Array.from({ length: 101 }, (_, i) => pageRow(i + 1));
    const first = await fetchTransactionPage(pageClient(), "h-1", range);
    expect(first.items.map((r) => r.id)).toEqual(Array.from({ length: 50 }, (_, i) => pageRow(101 - i).id));
    expect(first.previousCursor).toBeNull();
    // 先頭へ新しい記録を追加し、既読の記録と境界の記録を削除する。
    state.data = state.data.filter((row) => ![pageRow(100).id, pageRow(52).id].includes((row as {id:string}).id));
    state.data.push(pageRow(102));
    const next = await fetchTransactionPage(pageClient(), "h-1", range, { cursor: first.nextCursor! });
    expect(next.items.map((r) => r.id)).toEqual(Array.from({ length: 50 }, (_, i) => pageRow(51 - i).id));
    expect(next.items.some((row) => first.items.some((old) => old.id === row.id))).toBe(false);
    expect(next.nextCursor).not.toBeNull();
  });

  it("前のページは境界より新しい50件を取得して降順に戻す", async () => {
    state.data = Array.from({ length: 101 }, (_, i) => pageRow(i + 1));
    const first = await fetchTransactionPage(pageClient(), "h-1", range);
    const next = await fetchTransactionPage(pageClient(), "h-1", range, { cursor: first.nextCursor! });
    const previous = await fetchTransactionPage(pageClient(), "h-1", range, { cursor: next.previousCursor! });
    expect(previous.items).toEqual(first.items);
    expect(previous.previousCursor).toBeNull();
    expect(previous.nextCursor).not.toBeNull();
  });

  it("最後のページは次のリンクを返さず、不正・旧形式のカーソルは先頭扱いにする", async () => {
    state.data = [pageRow(1)];
    const result = await fetchTransactionPage(pageClient(), "h-1", range, { cursor: "50" });
    expect(result.items).toEqual([pageRow(1)]);
    expect(result.nextCursor).toBeNull();
    expect(result.previousCursor).toBeNull();
  });

  it("カーソル条件を期間・グループ・金額条件と合わせて送る", async () => {
    state.data = [pageRow(1)];
    const token = encodePageCursor(pageRow(2), "after");
    await fetchTransactionPage(pageClient(), "h-1", range, { cursor: token, filter: { minAmount: 100 } });
    expect(state.captured.filters["eq:household_id"]).toBe("h-1");
    expect(state.captured.filters["gte:amount"]).toBe(100);
    expect(state.captured.filters.or).toBe(cursorCondition(decodePageCursor(token)!));
    expect(state.ranges).toEqual([]);
  });
});

it("境界以降がすべて削除されても前へ戻るリンクを返す", async () => {
  state.data = [];
  const result = await fetchTransactionPage(pageClient(), "h-1", range, { cursor: encodePageCursor(pageRow(20), "after") });
  expect(result.items).toEqual([]);
  expect(decodePageCursor(result.previousCursor!)).toEqual({ ...pageRow(20), direction: "before" });
});

it("実際のSupabaseクエリで名義人条件とページ境界を両方保持する", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const fetchMock = vi.fn().mockResolvedValue(new Response("[]", { headers: { "Content-Type": "application/json" } }));
  const client = createClient("https://example.supabase.co", "test-public-key", { global: { fetch: fetchMock }, auth: { persistSession: false } });
  const cursor = encodePageCursor(pageRow(20), "after");
  await fetchTransactionPage(client, "11111111-1111-4111-8111-111111111111", range, { cursor, filter: { createdBy: MEMBER_ID } });
  const params = new URL(fetchMock.mock.calls[0][0]).searchParams;
  expect(params.getAll("or")).toEqual([
    `(on_behalf_of.eq.${MEMBER_ID},and(on_behalf_of.is.null,created_by.eq.${MEMBER_ID}))`,
    `(${cursorCondition(decodePageCursor(cursor)!)})`,
  ]);
  expect(params.get("order")).toBe("date.desc,created_at.desc,id.desc");
  expect(params.get("limit")).toBe("51");
});
