import { describe, expect, it, vi } from "vitest";

import type { ServerClient } from "@/lib/household";

import { fetchHouseholdCategories } from "./categories";
import { DataAccessError } from "./errors";

type Row = {
  id: string;
  name: string;
  color: string | null;
  type: "income" | "expense" | "both";
};

/**
 * `.from().select().eq().order().order()` を辿ってから解決する最小のスタブ。
 * 呼ばれた select 列・eq 条件・order 列を記録して検証できるようにする。
 */
function createClientStub(result: {
  data?: Row[] | null;
  error?: { message: string } | null;
}) {
  const calls = {
    table: "",
    select: "",
    eq: [] as [string, string][],
    order: [] as string[],
  };

  const query = {
    select: (columns: string) => {
      calls.select = columns;
      return query;
    },
    eq: (column: string, value: string) => {
      calls.eq.push([column, value]);
      return query;
    },
    order: (column: string) => {
      calls.order.push(column);
      return query;
    },
    then: (
      resolve: (value: {
        data: Row[] | null;
        error: { message: string } | null;
      }) => unknown,
    ) => resolve({ data: result.data ?? null, error: result.error ?? null }),
  };

  const supabase = {
    from: (table: string) => {
      calls.table = table;
      return query;
    },
  } as unknown as ServerClient;

  return { supabase, calls };
}

describe("fetchHouseholdCategories", () => {
  it("household_id でスコープし、type・name の昇順で取得する", async () => {
    const rows: Row[] = [
      { id: "c-1", name: "給与", color: "#0f0", type: "income" },
      { id: "c-2", name: "食費", color: "#f00", type: "expense" },
    ];
    const { supabase, calls } = createClientStub({ data: rows });

    const categories = await fetchHouseholdCategories(supabase, "h-1");

    expect(categories).toEqual(rows);
    expect(calls.table).toBe("categories");
    expect(calls.eq).toEqual([["household_id", "h-1"]]);
    expect(calls.order).toEqual(["type", "name"]);
  });

  it("フォームが必要とする id・name・color・type を取得する", async () => {
    const { supabase, calls } = createClientStub({ data: [] });

    await fetchHouseholdCategories(supabase, "h-1");

    for (const column of ["id", "name", "color", "type"]) {
      expect(calls.select).toContain(column);
    }
  });

  it("データが無い場合は空配列を返す", async () => {
    const { supabase } = createClientStub({ data: null });

    await expect(fetchHouseholdCategories(supabase, "h-1")).resolves.toEqual([]);
  });

  it("取得エラーを空配列にせず DataAccessError を投げる", async () => {
    const { supabase } = createClientStub({ error: { message: "failed" } });

    await expect(
      fetchHouseholdCategories(supabase, "h-1"),
    ).rejects.toBeInstanceOf(DataAccessError);
  });

  it("エラー時は呼び出し元を特定できる操作名を含める", async () => {
    const { supabase } = createClientStub({ error: { message: "failed" } });
    const spy = vi.fn();

    await fetchHouseholdCategories(supabase, "h-1").catch(spy);

    expect(spy.mock.calls[0][0].message).toContain("fetchHouseholdCategories");
  });
});
