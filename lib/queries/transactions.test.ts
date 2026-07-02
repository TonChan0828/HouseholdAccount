import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTransactionsInRange } from "./transactions";

type OrderCall = { column: string; ascending: boolean };

const state = vi.hoisted(() => ({
  data: null as unknown[] | null,
  captured: {
    table: "",
    select: "",
    filters: {} as Record<string, string>,
    orders: [] as OrderCall[],
  },
}));

function makeClient() {
  const query = {
    select: (columns: string) => {
      state.captured.select = columns;
      return query;
    },
    eq: (column: string, value: string) => {
      state.captured.filters[`eq:${column}`] = value;
      return query;
    },
    gte: (column: string, value: string) => {
      state.captured.filters[`gte:${column}`] = value;
      return query;
    },
    lt: (column: string, value: string) => {
      state.captured.filters[`lt:${column}`] = value;
      return query;
    },
    order: (column: string, opts?: { ascending?: boolean }) => {
      state.captured.orders.push({
        column,
        ascending: opts?.ascending ?? true,
      });
      return query;
    },
    overrideTypes: () => Promise.resolve({ data: state.data, error: null }),
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

  it("結果が null の場合は空配列を返す", async () => {
    state.data = null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await fetchTransactionsInRange(makeClient() as any, "h-1", range);

    expect(rows).toEqual([]);
  });
});
