import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryResult = { data: unknown; error: unknown; count?: number | null };

const { state, pagination, logServerError, supabase } = vi.hoisted(() => {
  const state: Record<string, QueryResult> = {
    transactions: { data: [], error: null },
    household_members: { data: [], error: null },
    profiles: { data: [], error: null },
  };

  const pagination = { cap: 1000, failAt: -1, truncateAt: -1, countAt: -1, calls: [] as number[] };

  function queryFor(table: string) {
    let offset = 0;
    let end = 0;
    const query: Record<string, unknown> = {};
    for (const method of ["select", "eq", "gte", "lt", "order", "in"]) {
      query[method] = () => query;
    }
    query.range = (start: number, last: number) => {
      offset = start;
      end = last;
      pagination.calls.push(start);
      return query;
    };
    query.overrideTypes = () => {
      const result = state[table];
      if (result.error || !Array.isArray(result.data)) return Promise.resolve(result);
      return Promise.resolve({
        data: offset === pagination.truncateAt ? [] : result.data.slice(offset, Math.min(end + 1, offset + pagination.cap)),
        error: offset === pagination.failAt ? { code: "DB_UNAVAILABLE" } : null,
        count: offset === pagination.countAt ? result.data.length + 1 : result.count === null ? null : result.data.length,
      });
    };
    query.then = (
      resolve: (value: QueryResult) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve(state[table]).then(resolve, reject);
    return query;
  }

  return {
    state,
    pagination,
    logServerError: vi.fn(),
    supabase: { from: vi.fn((table: string) => queryFor(table)) },
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => supabase,
}));
vi.mock("@/lib/household", () => ({
  getCurrentUser: () => Promise.resolve({ id: "user-1" }),
  getActiveHouseholdId: () => Promise.resolve("household-1"),
  getHouseholdSettings: () => Promise.resolve({ periodStartDay: 1 }),
}));
vi.mock("@/lib/observability", () => ({ logServerError }));

import { GET } from "./route";

describe("GET /transactions/export", () => {
  beforeEach(() => {
    state.transactions = {
      data: [
        {
          id: "transaction-1",
          amount: 1200,
          type: "expense",
          date: "2026-09-10",
          memo: "昼食",
          created_by: "user-1",
          on_behalf_of: null,
          category: { name: "食費" },
        },
      ],
      error: null,
    };
    state.household_members = {
      data: [{ user_id: "user-1", display_name: "家計担当" }],
      error: null,
    };
    state.profiles = {
      data: [{ id: "user-1", display_name: "全体名" }],
      error: null,
    };
    Object.assign(pagination, { cap: 1000, failAt: -1, truncateAt: -1, countAt: -1, calls: [] });
    logServerError.mockReset();
    supabase.from.mockClear();
  });

  it("全クエリ成功時だけCSVを返す", async () => {
    const response = await GET(
      new NextRequest("http://localhost/transactions/export?ref=2026-09-10"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    await expect(response.text()).resolves.toContain("家計担当");
    expect(logServerError).not.toHaveBeenCalled();
  });

  it("取得上限を超える全1201件を出力する", async () => {
    const prototype = (state.transactions.data as Record<string, unknown>[])[0];
    state.transactions.data = Array.from({ length: 1201 }, (_, index) => ({
      ...prototype,
      id: `transaction-${index}`,
      memo: `記録${index}`,
    }));
    // サーバーの取得上限が要求した500件より小さい場合も検証する。
    pagination.cap = 200;
    const response = await GET(new NextRequest("http://localhost/transactions/export?ref=2026-09-10"));
    expect(response.status).toBe(200);
    const csv = await response.text();
    expect(csv.trim().split(/\r?\n/)).toHaveLength(1202);
    expect(csv).toContain("記録1200");
    expect(pagination.calls).toEqual([0, 200, 400, 600, 800, 1000, 1200]);
  });

  it("記録がない期間はヘッダーだけを返す", async () => {
    state.transactions.data = [];
    const response = await GET(new NextRequest("http://localhost/transactions/export?ref=2026-09-10"));
    expect(response.status).toBe(200);
    expect((await response.text()).trim().split(/\r?\n/)).toHaveLength(1);
  });

  for (const failure of ["failAt", "truncateAt", "countAt"] as const) {
    it(`2ページ目の${failure}で不完全なCSVを返さない`, async () => {
      const prototype = (state.transactions.data as Record<string, unknown>[])[0];
      state.transactions.data = Array.from({ length: 501 }, (_, index) => ({ ...prototype, id: `transaction-${index}` }));
      pagination[failure] = 500;
      const response = await GET(new NextRequest("http://localhost/transactions/export?ref=2026-09-10"));
      expect(response.status).toBe(503);
      expect(response.headers.get("content-type")).toContain("application/json");
    });
  }

  it("総件数が確認できない場合はCSVを返さない", async () => {
    state.transactions.count = null;
    const response = await GET(new NextRequest("http://localhost/transactions/export?ref=2026-09-10"));
    expect(response.status).toBe(503);
  });

  it("重複した記録がある場合はCSVを返さない", async () => {
    const prototype = (state.transactions.data as Record<string, unknown>[])[0];
    state.transactions.data = [prototype, prototype];
    pagination.cap = 1;
    const response = await GET(new NextRequest("http://localhost/transactions/export?ref=2026-09-10"));
    expect(response.status).toBe(503);
  });

  for (const table of ["transactions", "household_members", "profiles"]) {
    it(`${table} の取得失敗を不完全なCSVとして返さない`, async () => {
      state[table] = { data: null, error: { code: "DB_UNAVAILABLE" } };

      const response = await GET(
        new NextRequest("http://localhost/transactions/export?ref=2026-09-10"),
      );

      expect(response.status).toBe(503);
      expect(response.headers.get("content-type")).toContain("application/json");
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          error: "CSVの作成に失敗しました",
          requestId: expect.any(String),
        }),
      );
      expect(logServerError).toHaveBeenCalledWith(
        "transactions.export.failed",
        expect.any(Error),
        expect.objectContaining({ requestId: expect.any(String) }),
      );
    });
  }
});
