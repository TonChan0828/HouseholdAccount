import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AnalyticsPage from "./page";

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

const fetchSpy = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<never[]>>(async () => []),
);
vi.mock("@/lib/queries/transactions", () => ({
  fetchTransactionsInRange: fetchSpy,
}));

describe("AnalyticsPage", () => {
  it("分析画面を表示する", async () => {
    await AnalyticsPage({ searchParams: Promise.resolve({}) });
  });

  it("view=year で年間ビューを表示し、前年1期目〜当年末を1回で取得する", async () => {
    fetchSpy.mockClear();
    const ui = await AnalyticsPage({
      searchParams: Promise.resolve({ view: "year", year: "2025" }),
    });
    render(ui);
    expect(screen.getByText("2025年")).toBeInTheDocument();
    expect(screen.getByText("月別推移（12期）")).toBeInTheDocument();
    expect(screen.getByText("カテゴリ別支出（年間）")).toBeInTheDocument();
    expect(screen.getByText("前年比較")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "年間" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "前の期間" })).toHaveAttribute(
      "href",
      "/analytics?view=year&year=2024",
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const range = fetchSpy.mock.calls[0][2] as { start: Date; end: Date };
    expect(range.start.toISOString().slice(0, 10)).toBe("2024-01-01");
    expect(range.end.toISOString().slice(0, 10)).toBe("2026-01-01");
  });
});
