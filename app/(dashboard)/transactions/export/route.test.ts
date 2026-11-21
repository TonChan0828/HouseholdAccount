import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryResult = { data: unknown; error: unknown; count?: number | null };

const { state, pagination, filters, logServerError, supabase, access } = vi.hoisted(() => {
  const state: Record<string, QueryResult> = {
    transactions: { data: [], error: null },
    household_members: { data: [], error: null },
    profiles: { data: [], error: null },
  };

  const filters: [string, string, unknown][] = [];
  const pagination = { cap: 1000, failAt: -1, truncateAt: -1, countAt: -1, calls: [] as number[] };

  function queryFor(table: string) {
    let offset = 0;
    let end = 0;
    const query: Record<string, unknown> = {};
    for (const method of ["select", "eq", "gte", "lte", "lt", "order", "in", "or", "ilike"]) {
      query[method] = (column: string, value: unknown) => { filters.push([method, column, value]); return query; };
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
    filters,
    logServerError: vi.fn(),
    access: { signedIn: true, groupId: "household-1" as string | null },
    supabase: { from: vi.fn((table: string) => queryFor(table)) },
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => supabase,
}));
vi.mock("@/lib/household", () => ({
  getCurrentUser: () => Promise.resolve(access.signedIn ? { id: "user-1" } : null),
  getActiveHouseholdId: () => Promise.resolve(access.groupId),
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
    filters.length = 0;
    logServerError.mockReset();
    Object.assign(access, { signedIn: true, groupId: "household-1" });
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

  it.each([[false, null, 401], [true, null, 403]] as const)(
    "認証または対象グループがなければCSVを返さない", async (signedIn, groupId, status) => {
      Object.assign(access, { signedIn, groupId });
      const response = await GET(new NextRequest("http://localhost/transactions/export?start=2024-02-29&end=2024-02-29"));
      expect(response.status).toBe(status);
      expect(supabase.from).not.toHaveBeenCalled();
    },
  );

  it.each([500, 501])("%i件のページ境界で全行を一度ずつ出力する", async (count) => {
    const sample = (state.transactions.data as Record<string, unknown>[])[0];
    state.transactions.data = Array.from({ length: count }, (_, index) => ({
      ...sample, id: `transaction-${index}`, memo: `明細${index}`,
    }));
    const response = await GET(new NextRequest("http://localhost/transactions/export?start=2026-09-10&end=2026-09-10"));
    expect(response.status).toBe(200);
    const rows = (await response.text()).trim().split(/\r?\n/).slice(1);
    expect(rows).toHaveLength(count);
    expect(new Set(rows).size).toBe(count);
    expect(filters).toContainEqual(["eq", "household_id", "household-1"]);
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

it("CSVへ種別・カテゴリ・名義人・メモ・金額の絞り込みを反映する", async () => {
  const category = "11111111-1111-4111-8111-111111111111";
  const member = "22222222-2222-4222-8222-222222222222";
  state.transactions = { data: [], error: null };
  state.household_members = { data: [], error: null };
  state.profiles = { data: [], error: null };
  Object.assign(pagination, { cap: 1000, failAt: -1, truncateAt: -1, countAt: -1, calls: [] });
  filters.length = 0;
  const response = await GET(new NextRequest(`http://localhost/transactions/export?ref=2026-09-01&type=expense&category=${category}&member=${member}&q=100%25&min=0&max=5000`));
  expect(response.status).toBe(200);
  expect(filters).toContainEqual(["eq", "type", "expense"]);
  expect(filters).toContainEqual(["eq", "category_id", category]);
  expect(filters).toContainEqual(["or", `on_behalf_of.eq.${member},and(on_behalf_of.is.null,created_by.eq.${member})`, undefined]);
  expect(filters).toContainEqual(["ilike", "memo", "%100\\%%"]);
  expect(filters).toContainEqual(["gte", "amount", 0]);
  expect(filters).toContainEqual(["lte", "amount", 5000]);
});

describe("CSVの期間指定", () => {
  it.each(["start=2024-02-29", "start=2025-02-29&end=2025-03-01", "start=2024-03-01&end=2024-02-29"])(
    "無効な指定を拒否する: %s", async (query) => {
      const response = await GET(new NextRequest(`http://localhost/transactions/export?${query}`));
      expect(response.status).toBe(400);
    },
  );

  it("うるう日の同日指定で両端を含める", async () => {
    const response = await GET(new NextRequest("http://localhost/transactions/export?start=2024-02-29&end=2024-02-29"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(filters).toContainEqual(["gte", "date", "2024-02-29"]);
    expect(filters).toContainEqual(["lte", "date", "2024-02-29"]);
  });
});
