import { describe, expect, it, vi } from "vitest";

import BudgetsPage from "./page";
import { ensureRecurringGenerated } from "@/lib/recurring";

/** 何をどう繋いでも { data: [] } を返すチェーン可能なクエリのモック。 */
function chainableQuery() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q: any = {};
  for (const m of ["select", "eq", "gte", "lt", "in", "order"]) {
    q[m] = () => q;
  }
  q.overrideTypes = () => Promise.resolve({ data: [], error: null });
  q.maybeSingle = () => Promise.resolve({ data: null, error: null });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  q.then = (resolve: any) =>
    Promise.resolve({ data: [], error: null }).then(resolve);
  return q;
}

vi.mock("@/lib/household", () => ({
  requireDashboardContext: async () => ({
    user: { id: "u-1" },
    householdId: "h-1",
    supabase: { from: () => chainableQuery() },
  }),
  getHouseholdSettings: async () => ({ periodStartDay: 1 }),
}));

vi.mock("@/lib/recurring", () => ({
  ensureRecurringGenerated: vi.fn(async () => {}),
}));

vi.mock("@/lib/queries/transactions", () => ({
  fetchTransactionsInRange: async () => [],
}));

describe("BudgetsPage", () => {
  it("表示時に当期の定期収支を生成する（実績から漏らさない）", async () => {
    await BudgetsPage({ searchParams: Promise.resolve({}) });

    expect(ensureRecurringGenerated).toHaveBeenCalledWith("h-1");
  });
});
