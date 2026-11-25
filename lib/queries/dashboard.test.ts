import { describe, expect, it, vi } from "vitest";

import { loadDashboardData } from "./dashboard";

vi.mock("@/lib/queries/transactions", () => ({
  fetchTransactionsInRange: vi
    .fn()
    .mockResolvedValueOnce([{ id: "current" }])
    .mockResolvedValueOnce([{ id: "previous" }]),
}));

vi.mock("@/lib/queries/members", () => ({
  getHouseholdMemberNames: vi.fn(async () => [
    { user_id: "u-1", display_name: "ユーザー" },
  ]),
}));

function client() {
  return {
    rpc: vi.fn(async () => ({ data: 300, error: null })),
    from(table: string) {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({
          data:
            table === "savings_goals"
              ? {
                  name: "目標",
                  target_amount: 1000,
                  start_date: "2026-01-01",
                  target_date: null,
                }
              : null,
          error: null,
        }),
        then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
          const data =
            table === "budgets"
              ? [{ category_id: "c-1", amount: 500 }]
              : table === "categories"
                ? [{ id: "c-1", name: "家賃" }]
                : [];
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return query;
    },
  };
}

describe("loadDashboardData", () => {
  it("ダッシュボードに必要な取得を一つのloaderで返す", async () => {
    const supabase = client();
    const data = await loadDashboardData(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      "h-1",
      {
        current: { start: new Date("2026-07-01"), end: new Date("2026-08-01") },
        previous: { start: new Date("2026-06-01"), end: new Date("2026-07-01") },
      },
      new Date("2026-07-15"),
    );

    expect(data.transactions).toEqual([{ id: "current" }]);
    expect(data.previousTransactions).toEqual([{ id: "previous" }]);
    expect(data.members).toHaveLength(1);
    expect(data.budgets).toEqual([{ category_id: "c-1", amount: 500 }]);
    expect(data.savingsGoal.progress?.saved).toBe(300);
    expect(supabase.rpc).toHaveBeenCalledWith("savings_goal_balance", {
      _household_id: "h-1",
      _start_date: "2026-01-01",
    });
    expect(data.reminderTargets).toEqual([{ id: "c-1", name: "家賃" }]);
  });
});
