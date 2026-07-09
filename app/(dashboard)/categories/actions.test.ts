import { beforeEach, describe, expect, it, vi } from "vitest";

import { toggleCategoryReminder } from "./actions";

const state = vi.hoisted(() => ({
  updates: [] as { table: string; values: unknown; filters: [string, unknown][] }[],
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
