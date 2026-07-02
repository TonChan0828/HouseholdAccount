import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createRecurring,
  deleteRecurring,
  toggleRecurringActive,
  updateRecurring,
} from "./actions";

const state = vi.hoisted(() => ({
  inserts: [] as { table: string; values: unknown }[],
  updates: [] as { table: string; values: unknown; filters: [string, unknown][] }[],
  deletes: [] as { table: string; filters: [string, unknown][] }[],
  rpcCalls: [] as { fn: string; args: unknown }[],
  updateResult: { data: [{ id: "r-1" }], error: null } as {
    data: { id: string }[] | null;
    error: unknown;
  },
  insertError: null as unknown,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/household", () => ({
  requireDashboardContext: async () => {
    const { createClient } = await import("@/lib/supabase/server");
    return {
      user: { id: "u-1" },
      householdId: "h-1",
      supabase: await createClient(),
    };
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "u-1" } } }),
    },
    rpc: async (fn: string, args: unknown) => {
      state.rpcCalls.push({ fn, args });
      return { data: 1, error: null };
    },
    from: (table: string) => ({
      insert: async (values: unknown) => {
        state.inserts.push({ table, values });
        return { error: state.insertError };
      },
      update: (values: unknown) => {
        const filters: [string, unknown][] = [];
        const chain = {
          eq: (col: string, val: unknown) => {
            filters.push([col, val]);
            return chain;
          },
          select: async () => {
            state.updates.push({ table, values, filters });
            return state.updateResult;
          },
          then: (resolve: (v: unknown) => unknown) => {
            // select を呼ばない update（toggle）はそのまま await される。
            state.updates.push({ table, values, filters });
            return resolve({ error: null });
          },
        };
        return chain;
      },
      delete: () => {
        const filters: [string, unknown][] = [];
        const chain = {
          eq: (col: string, val: unknown) => {
            filters.push([col, val]);
            return chain;
          },
          then: (resolve: (v: unknown) => unknown) => {
            state.deletes.push({ table, filters });
            return resolve({ error: null });
          },
        };
        return chain;
      },
    }),
  }),
}));

function formDataWith(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [k, v] of Object.entries(fields)) formData.set(k, v);
  return formData;
}

beforeEach(() => {
  state.inserts = [];
  state.updates = [];
  state.deletes = [];
  state.rpcCalls = [];
  state.updateResult = { data: [{ id: "r-1" }], error: null };
  state.insertError = null;
});

describe("createRecurring", () => {
  it("定期項目を作成し、当期分生成 RPC を呼んでからリダイレクトする", async () => {
    await expect(
      createRecurring(
        undefined,
        formDataWith({
          type: "expense",
          amount: "9800",
          category_id: "",
          memo: "サブスク",
          is_active: "true",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/transactions/recurring");

    expect(state.inserts).toEqual([
      {
        table: "recurring_transactions",
        values: {
          household_id: "h-1",
          created_by: "u-1",
          type: "expense",
          amount: 9800,
          category_id: null,
          memo: "サブスク",
          is_active: true,
        },
      },
    ]);
    expect(state.rpcCalls).toEqual([
      { fn: "generate_due_recurring", args: { _household_id: "h-1" } },
    ]);
  });

  it("不正な入力ではエラーを返し、insert を呼ばない", async () => {
    const result = await createRecurring(
      undefined,
      formDataWith({ type: "expense", amount: "0", is_active: "true" }),
    );
    expect(result).toEqual({ error: expect.any(String) });
    expect(state.inserts).toHaveLength(0);
    expect(state.rpcCalls).toHaveLength(0);
  });
});

describe("updateRecurring", () => {
  it("id と household_id でスコープして更新する", async () => {
    await expect(
      updateRecurring(
        undefined,
        formDataWith({
          id: "r-1",
          type: "income",
          amount: "250000",
          category_id: "",
          memo: "",
          is_active: "false",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/transactions/recurring");

    expect(state.updates[0].table).toBe("recurring_transactions");
    expect(state.updates[0].values).toMatchObject({
      type: "income",
      amount: 250000,
      is_active: false,
    });
    expect(state.updates[0].filters).toEqual([
      ["id", "r-1"],
      ["household_id", "h-1"],
    ]);
  });

  it("対象が見つからなければエラーを返す", async () => {
    state.updateResult = { data: [], error: null };
    const result = await updateRecurring(
      undefined,
      formDataWith({
        id: "missing",
        type: "expense",
        amount: "1000",
        category_id: "",
        memo: "",
        is_active: "true",
      }),
    );
    expect(result).toEqual({ error: "対象の定期項目が見つかりません" });
  });
});

describe("deleteRecurring", () => {
  it("id と household_id でスコープして削除する", async () => {
    await expect(
      deleteRecurring(formDataWith({ id: "r-1" })),
    ).rejects.toThrow("NEXT_REDIRECT:/transactions/recurring");

    expect(state.deletes).toEqual([
      {
        table: "recurring_transactions",
        filters: [
          ["id", "r-1"],
          ["household_id", "h-1"],
        ],
      },
    ]);
  });

  it("id が無ければ何もしない", async () => {
    await deleteRecurring(formDataWith({}));
    expect(state.deletes).toHaveLength(0);
  });
});

describe("toggleRecurringActive", () => {
  it("is_active を更新する", async () => {
    await toggleRecurringActive(
      formDataWith({ id: "r-1", is_active: "false" }),
    );
    expect(state.updates[0].values).toEqual({ is_active: false });
    expect(state.updates[0].filters).toEqual([
      ["id", "r-1"],
      ["household_id", "h-1"],
    ]);
  });
});
