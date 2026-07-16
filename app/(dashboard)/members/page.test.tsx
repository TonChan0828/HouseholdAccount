import { describe, it, vi } from "vitest";

import MembersPage from "./page";

vi.mock("@/lib/household", () => ({
  requireDashboardContext: async () => ({
    user: { id: "u-1" },
    householdId: "h-1",
    supabase: {},
  }),
  getHouseholdSettings: async () => ({ periodStartDay: 1 }),
}));

vi.mock("@/lib/queries/members", () => ({
  getHouseholdMemberNames: async () => [],
}));

vi.mock("@/lib/queries/transactions", () => ({
  fetchTransactionsInRange: async () => [],
}));

describe("MembersPage", () => {
  it("メンバー画面を表示する", async () => {
    await MembersPage({ searchParams: Promise.resolve({}) });
  });
});
