import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryResult = { data: unknown; error: unknown };

const { state, logServerError, supabase } = vi.hoisted(() => {
  const state: Record<string, QueryResult> = {
    transactions: { data: [], error: null },
    household_members: { data: [], error: null },
    profiles: { data: [], error: null },
  };

  function queryFor(table: string) {
    const query: Record<string, unknown> = {};
    for (const method of ["select", "eq", "gte", "lt", "order", "in"]) {
      query[method] = () => query;
    }
    query.overrideTypes = () => Promise.resolve(state[table]);
    query.then = (
      resolve: (value: QueryResult) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve(state[table]).then(resolve, reject);
    return query;
  }

  return {
    state,
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
