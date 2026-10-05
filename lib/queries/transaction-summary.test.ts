import { describe, expect, it, vi } from "vitest";
import type { ServerClient } from "@/lib/household";
import { fetchTransactionSummary } from "./transaction-summary";
import { DataAccessError } from "./errors";
const range = { start: new Date("2026-10-01T00:00:00Z"), end: new Date("2026-11-01T00:00:00Z") };
it("日計のみ取得して、期間の収入・支出・件数と日計を返す", async () => {
  const rpc = vi.fn().mockResolvedValue({ data: [
    { date: "2026-10-01", income: 3000, expense: 100, count: 2 },
    { date: "2026-10-02", income: 0, expense: 200, count: 1 },
  ], error: null });
  const result = await fetchTransactionSummary({ rpc } as unknown as ServerClient, "group", range, { type: "expense", categoryId: "category", createdBy: "member", memoQuery: "100%_\\", minAmount: 0, maxAmount: 1000 });
  expect(result).toMatchObject({ income: 3000, expense: 300, count: 3 });
  expect(result.dailyTotals.get("2026-10-02")).toEqual({ income: 0, expense: 200 });
  expect(rpc).toHaveBeenCalledWith("transaction_daily_summary", {
    _household_id: "group", _start: "2026-10-01", _end: "2026-11-01", _type: "expense", _category_id: "category", _member_id: "member", _memo_pattern: "%100\\%\\_\\\\%", _min_amount: 0, _max_amount: 1000,
  });
});
describe("summary failures", () => {
  it("空の期間は0を返す", async () => {
    const result = await fetchTransactionSummary({ rpc: vi.fn().mockResolvedValue({ data: [], error: null }) } as unknown as ServerClient, "group", range);
    expect(result).toEqual({ income: 0, expense: 0, count: 0, dailyTotals: new Map() });
  });
  it("取得失敗を0円と見せず送出する", async () => {
    await expect(fetchTransactionSummary({ rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "DB" } }) } as unknown as ServerClient, "group", range)).rejects.toBeInstanceOf(DataAccessError);
  });
});
