import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataAccessError } from "./errors";
import { fetchTransactionPage, fetchTransactionsInRange } from "./transactions";

type OrderCall = { column: string; ascending: boolean };

const state = vi.hoisted(() => ({
  data: null as unknown[] | null,
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
    order: (column: string, opts?: { ascending?: boolean }) => {
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
    overrideTypes: () =>
      Promise.resolve({
        data: state.data?.slice(state.range[0], state.range[1] + 1) ?? null,
        error: state.error,
      }),
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
  state.error = null;
  state.range = [0, 999];
  state.ranges = [];
  state.captured = { table: "", select: "", filters: {}, orders: [] };
});

const range = {
  start: new Date("2026-07-01T00:00:00Z"),
  end: new Date("2026-08-01T00:00:00Z"),
};

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
    expect(state.captured.select).toContain("category:categories(name, color)");
    expect(state.captured.select).toContain("is_shared");
  });

  it("既定では date・created_at の降順で並べる", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await fetchTransactionsInRange(makeClient() as any, "h-1", range);

    expect(state.captured.orders).toEqual([
      { column: "date", ascending: false },
      { column: "created_at", ascending: false },
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
    ]);
  });

  it("filter の各条件を指定時のみクエリに追加する（spec 36）", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await fetchTransactionsInRange(makeClient() as any, "h-1", range, {
      filter: {
        type: "expense",
        categoryId: "cat-1",
        createdBy: "user-1",
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
      "eq:created_by": "user-1",
      "gte:amount": 100,
      "lte:amount": 5000,
    });
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

  it("Supabaseエラーを空配列にせず送出する", async () => {
    state.error = { message: "connection failed" };

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetchTransactionsInRange(makeClient() as any, "h-1", range),
    ).rejects.toBeInstanceOf(DataAccessError);
  });
});

describe("fetchTransactionPage", () => {
  it("50件と次カーソルを返す", async () => {
    state.data = Array.from({ length: 101 }, (_, id) => ({ id }));

    const result = await fetchTransactionPage(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeClient() as any,
      "h-1",
      range,
      { cursor: "50" },
    );

    expect(result.items).toHaveLength(50);
    expect(result.nextCursor).toBe("100");
    expect(result.previousCursor).toBe("0");
    expect(state.ranges).toEqual([[50, 100]]);
  });
});
