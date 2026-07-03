import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSettlement, deleteSettlement } from "./actions";

type QueryCall = {
  table: string;
  method: string;
  values?: unknown;
  filters: Record<string, string>;
};

const state = vi.hoisted(() => ({
  householdId: null as string | null,
  members: [] as { user_id: string; display_name: string }[],
  txs: [] as unknown[],
  insertError: null as { code?: string; message: string } | null,
  calls: [] as QueryCall[],
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

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
  getHouseholdSettings: async () => ({ periodStartDay: 1 }),
}));

vi.mock("@/lib/queries/members", () => ({
  getHouseholdMemberNames: async () => state.members,
}));

vi.mock("@/lib/queries/transactions", () => ({
  fetchTransactionsInRange: async () => state.txs,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const call: QueryCall = { table, method: "", filters: {} };
      state.calls.push(call);
      const query = {
        insert(values: unknown) {
          call.method = "insert";
          call.values = values;
          return Promise.resolve({ error: state.insertError });
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
          return Promise.resolve({ error: null }).then(onFulfilled, onRejected);
        },
      };
      return query;
    },
  }),
}));

function settleFormData(ref = "2026-07-01") {
  const formData = new FormData();
  formData.set("ref", ref);
  return formData;
}

beforeEach(() => {
  state.householdId = "h-1";
  state.members = [
    { user_id: "u-1", display_name: "太郎" },
    { user_id: "u-2", display_name: "花子" },
  ];
  state.txs = [
    { amount: 3000, type: "expense", created_by: "u-1", is_shared: true },
    { amount: 1000, type: "expense", created_by: "u-2", is_shared: true },
  ];
  state.insertError = null;
  state.calls = [];
});

describe("createSettlement", () => {
  it("再計算した snapshot を household・period_start・settled_by とともに insert する", async () => {
    const result = await createSettlement(undefined, settleFormData());

    expect(result).toBeUndefined();
    const insert = state.calls.find((c) => c.method === "insert");
    expect(insert?.table).toBe("settlements");
    expect(insert?.values).toMatchObject({
      household_id: "h-1",
      period_start: "2026-07-01",
      settled_by: "u-1",
    });
    const snapshot = (insert?.values as { snapshot: { total: number } })
      .snapshot;
    expect(snapshot.total).toBe(4000);
  });

  it("unique 違反（23505）は「すでに精算済みです」を返す", async () => {
    state.insertError = { code: "23505", message: "duplicate" };

    const result = await createSettlement(undefined, settleFormData());

    expect(result?.error).toBe("すでに精算済みです");
  });

  it("メンバーが1人ならエラーを返し insert しない", async () => {
    state.members = [{ user_id: "u-1", display_name: "太郎" }];

    const result = await createSettlement(undefined, settleFormData());

    expect(result?.error).toBeTruthy();
    expect(state.calls.find((c) => c.method === "insert")).toBeUndefined();
  });

  it("精算対象の支出が0件ならエラーを返し insert しない", async () => {
    state.txs = [];

    const result = await createSettlement(undefined, settleFormData());

    expect(result?.error).toBe("この期間に精算対象の支出はありません");
    expect(state.calls.find((c) => c.method === "insert")).toBeUndefined();
  });

  it("グループ未選択の場合は /households にリダイレクトする", async () => {
    state.householdId = null;

    await expect(
      createSettlement(undefined, settleFormData()),
    ).rejects.toThrow("NEXT_REDIRECT:/households");
    expect(state.calls).toHaveLength(0);
  });
});

describe("deleteSettlement", () => {
  it("id と household_id でスコープして削除する", async () => {
    const formData = new FormData();
    formData.set("id", "s-1");

    await deleteSettlement(formData);

    const del = state.calls.find((c) => c.method === "delete");
    expect(del?.table).toBe("settlements");
    expect(del?.filters).toEqual({ id: "s-1", household_id: "h-1" });
  });

  it("id が無ければ何もしない", async () => {
    await deleteSettlement(new FormData());

    expect(state.calls).toHaveLength(0);
  });
});
