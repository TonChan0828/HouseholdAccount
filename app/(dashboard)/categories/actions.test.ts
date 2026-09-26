import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCategory, toggleCategoryReminder } from "./actions";

const state = vi.hoisted(() => ({
  updates: [] as { table: string; values: unknown; filters: [string, unknown][] }[],
  inserts: [] as { table: string; values: unknown }[],
  insertError: null as { code: string } | null,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

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
    from: (table: string) => ({
      insert: (values: unknown) => ({
        then: (resolve: (v: unknown) => unknown) => {
          state.inserts.push({ table, values });
          return resolve({ error: state.insertError });
        },
      }),
      update: (values: unknown) => {
        const filters: [string, unknown][] = [];
        const chain = {
          eq: (col: string, val: unknown) => {
            filters.push([col, val]);
            return chain;
          },
          then: (resolve: (v: unknown) => unknown) => {
            state.updates.push({ table, values, filters });
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
  state.updates = [];
  state.inserts = [];
  state.insertError = null;
});

describe("createCategory", () => {
  it("DBが同種別の正規化重複名を拒否したら利用者向けエラーを返す", async () => {
    state.insertError = { code: "23505" };
    const result = await createCategory(
      undefined,
      formDataWith({ name: " groceries ", color: "#ef4444", type: "expense" }),
    );

    expect(result).toEqual({
      error: "同じ種別のカテゴリに同じ名前が既にあります",
    });
    expect(state.inserts).toEqual([
      {
        table: "categories",
        values: {
          household_id: "h-1",
          name: "groceries",
          color: "#ef4444",
          type: "expense",
          is_default: false,
        },
      },
    ]);
  });
});

describe("toggleCategoryReminder", () => {
  it("id と household_id でスコープして reminder_enabled を更新する（is_default 制限なし）", async () => {
    await toggleCategoryReminder(
      formDataWith({ id: "c-1", reminder_enabled: "true" }),
    );
    expect(state.updates).toEqual([
      {
        table: "categories",
        values: { reminder_enabled: true },
        filters: [
          ["id", "c-1"],
          ["household_id", "h-1"],
        ],
      },
    ]);
  });

  it("reminder_enabled=false も反映する", async () => {
    await toggleCategoryReminder(
      formDataWith({ id: "c-1", reminder_enabled: "false" }),
    );
    expect(state.updates[0].values).toEqual({ reminder_enabled: false });
  });

  it("id が無ければ何もしない", async () => {
    await toggleCategoryReminder(formDataWith({ reminder_enabled: "true" }));
    expect(state.updates).toHaveLength(0);
  });
});
