import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  summary: vi.fn(), page: vi.fn(), full: vi.fn(),
}));
vi.mock("@/lib/household", () => ({
  requireDashboardContext: async () => ({ user: { id: "user" }, householdId: "household", supabase: {} }),
  getHouseholdSettings: async () => ({ periodStartDay: 1 }),
  getUserHouseholds: async () => [],
}));
vi.mock("@/lib/queries/transaction-summary", () => ({ fetchTransactionSummary: mocks.summary }));
vi.mock("@/lib/queries/transactions", () => ({ fetchTransactionPage: mocks.page, fetchTransactionsInRange: mocks.full }));
vi.mock("@/lib/queries/categories", () => ({ fetchHouseholdCategories: async () => [] }));
vi.mock("@/lib/queries/members", () => ({ getHouseholdMemberNames: async () => [] }));
vi.mock("@/components/features/transactions/filter-bar", () => ({ FilterBar: () => null }));
vi.mock("@/components/features/transactions/delete-transaction-button", () => ({ DeleteTransactionButton: () => null }));
vi.mock("@/components/features/transactions/transaction-dialog", () => ({
  TransactionDialogProvider: ({ children }: { children: React.ReactNode }) => children,
  EditTransactionButton: () => null, NewTransactionButton: () => null,
}));
import TransactionsPage from "./page";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.summary.mockResolvedValue({ income: 0, expense: 5100, count: 51, dailyTotals: new Map([["2026-10-05", { income: 0, expense: 5100 }]]) });
  mocks.page.mockResolvedValue({ items: [{ id: "transaction", date: "2026-10-05", amount: 100, type: "expense", memo: "one visible record", created_by: "user", on_behalf_of: null }], previousCursor: "previous", nextCursor: null });
});
it("表示する明細だけを取得し、件数と日計はデータベース集計を表示する", async () => {
  render(await TransactionsPage({ searchParams: Promise.resolve({ ref: "2026-10-01", type: "expense", q: "食費 & 日用品" }) }));
  expect(screen.getByText("51件の記録")).toBeInTheDocument();
  expect(screen.getByText("条件内の日計").parentElement).toHaveTextContent("¥5,100");
  expect(mocks.full).not.toHaveBeenCalled();
  expect(mocks.summary.mock.calls[0][3]).toEqual({ type: "expense", memoQuery: "食費 & 日用品" });
  for (const name of ["CSV出力", "カレンダー"]) {
    const params = new URL(screen.getByRole("link", { name }).getAttribute("href")!, "http://localhost").searchParams;
    expect(params.get("type")).toBe("expense");
    expect(params.get("q")).toBe("食費 & 日用品");
    expect(params.get("ref")).toBe("2026-10-01");
  }
});
it("明細がすべて削除されたページでも前のページへ戻れる", async () => {
  mocks.page.mockResolvedValue({ items: [], previousCursor: "previous", nextCursor: null });
  render(await TransactionsPage({ searchParams: Promise.resolve({ ref: "2026-10-01", cursor: "old" }) }));
  expect(screen.getByRole("link", { name: "前へ" })).toHaveAttribute("href", "/transactions?ref=2026-10-01&cursor=previous");
});
