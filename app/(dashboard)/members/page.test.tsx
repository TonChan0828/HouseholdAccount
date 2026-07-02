import { describe, expect, it, vi } from "vitest";

import MembersPage from "./page";
import { ensureRecurringGenerated } from "@/lib/recurring";

vi.mock("@/lib/household", () => ({
  requireDashboardContext: async () => ({
    user: { id: "u-1" },
    householdId: "h-1",
    supabase: {},
  }),
  getHouseholdSettings: async () => ({ periodStartDay: 1 }),
}));

vi.mock("@/lib/recurring", () => ({
  ensureRecurringGenerated: vi.fn(async () => {}),
}));

vi.mock("@/lib/queries/members", () => ({
  getHouseholdMemberNames: async () => [],
}));

vi.mock("@/lib/queries/transactions", () => ({
  fetchTransactionsInRange: async () => [],
}));

describe("MembersPage", () => {
  it("表示時に当期の定期収支を生成する（集計から漏らさない）", async () => {
    await MembersPage({ searchParams: Promise.resolve({}) });

    expect(ensureRecurringGenerated).toHaveBeenCalledWith("h-1");
  });
});
