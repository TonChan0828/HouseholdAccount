import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteBudget, upsertBudget } from "./actions";

type QueryCall = {
  table: string;
  method: string;
  values?: unknown;
  options?: unknown;
  filters: Record<string, string>;
};

const state = vi.hoisted(() => ({
  householdId: null as string | null,
  error: null as { message: string } | null,
  calls: [] as QueryCall[],
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/household", () => ({
  requireDashboardContext: async () => {
    if (!state.householdId) {
      throw new Error("NEXT_REDIRECT:/households");
    }
    const { createClient } = await import("@/lib/supabase/server");
    return {
      user: { id: "u-1" },
      householdId: state.householdId,
      supabase: await createClient(),
    };
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const call: QueryCall = { table, method: "", filters: {} };
      state.calls.push(call);
      const resolve = () => Promise.resolve({ error: state.error });
      const query = {
        upsert(values: unknown, options: unknown) {
          call.method = "upsert";
          call.values = values;
          call.options = options;
          return resolve();
        },
        delete() {
          call.method = "delete";
          return query;
        },
        eq(column: string, value: string) {
          call.filters[column] = value;
          return query;
        },
        then(
          onFulfilled: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) {
          return resolve().then(onFulfilled, onRejected);
        },
      };
      return query;
    },
  }),
}));

const CATEGORY_ID = "11111111-1111-4111-8111-111111111111";

function budgetFormData(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("category_id", CATEGORY_ID);
  formData.set("amount", "40000");
  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }
  return formData;
}

beforeEach(() => {
  state.householdId = "h-1";
  state.error = null;
  state.calls = [];
});

describe("upsertBudget", () => {
  it("household_id・category_id・amount を upsert する", async () => {
    const result = await upsertBudget(undefined, budgetFormData());

    expect(result).toBeUndefined();
    const upsert = state.calls.find((c) => c.method === "upsert");
    expect(upsert?.table).toBe("budgets");
    expect(upsert?.values).toMatchObject({
      household_id: "h-1",
      category_id: CATEGORY_ID,
      amount: 40000,
    });
  });

  it("household_id と category_id を競合キーに指定する", async () => {
    await upsertBudget(undefined, budgetFormData());

    const upsert = state.calls.find((c) => c.method === "upsert");
    expect(upsert?.options).toMatchObject({
      onConflict: "household_id,category_id",
    });
  });

  it("金額の四則演算式を評価して登録する", async () => {
    await upsertBudget(undefined, budgetFormData({ amount: "30000+10000" }));

    const upsert = state.calls.find((c) => c.method === "upsert");
    expect(upsert?.values).toMatchObject({ amount: 40000 });
  });

  it("不正な金額はエラーを返し DB を呼ばない", async () => {
    const result = await upsertBudget(undefined, budgetFormData({ amount: "0" }));

    expect(result?.error).toBeTruthy();
    expect(state.calls).toHaveLength(0);
  });

  it("グループ未選択の場合は /households にリダイレクトする", async () => {
    state.householdId = null;

    await expect(upsertBudget(undefined, budgetFormData())).rejects.toThrow(
      "NEXT_REDIRECT:/households",
    );
    expect(state.calls).toHaveLength(0);
  });
});

describe("deleteBudget", () => {
  it("category_id と household_id でスコープして削除する", async () => {
    const formData = new FormData();
    formData.set("category_id", CATEGORY_ID);

    await deleteBudget(formData);

    const del = state.calls.find((c) => c.method === "delete");
    expect(del?.table).toBe("budgets");
    expect(del?.filters).toEqual({
      category_id: CATEGORY_ID,
      household_id: "h-1",
    });
  });
});
