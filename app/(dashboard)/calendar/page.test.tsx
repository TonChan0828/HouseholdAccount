import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
const { fetchRows } = vi.hoisted(() => ({ fetchRows: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/household", () => ({
  requireDashboardContext: async () => ({ user: { id: "user" }, householdId: "household", supabase: {} }),
  getUserHouseholds: async () => [],
}));
vi.mock("@/lib/queries/transactions", () => ({ fetchTransactionsInRange: fetchRows }));
vi.mock("@/lib/queries/categories", () => ({ fetchHouseholdCategories: async () => [] }));
vi.mock("@/lib/queries/members", () => ({ getHouseholdMemberNames: async () => [] }));
vi.mock("@/components/features/transactions/filter-bar", () => ({ FilterBar: () => null }));
vi.mock("@/components/features/calendar/calendar-board", () => ({ CalendarBoard: () => null }));
vi.mock("@/components/features/transactions/transaction-dialog", () => ({
  TransactionDialogProvider: ({ children }: { children: React.ReactNode }) => children,
  NewTransactionButton: () => null,
}));
import CalendarPage from "./page";
it("カレンダーの取得、前後月、リストへ戻る操作でも条件を維持する", async () => {
  render(await CalendarPage({ searchParams: Promise.resolve({ ref: "2026-10-01", type: "expense", q: "100%", min: "0" }) }));
  expect(fetchRows.mock.calls[0][3]).toEqual({ order: "asc", filter: { type: "expense", memoQuery: "100%", minAmount: 0 } });
  for (const link of screen.getAllByRole("link")) {
    const params = new URL(link.getAttribute("href")!, "http://localhost").searchParams;
    expect(params.get("type")).toBe("expense");
    expect(params.get("q")).toBe("100%");
    expect(params.get("min")).toBe("0");
  }
});
