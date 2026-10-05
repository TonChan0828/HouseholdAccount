import { describe, expect, it } from "vitest";

import { groupByDate } from "@/lib/format";
import { calculateDailyTotals } from "./daily-totals";

describe("calculateDailyTotals", () => {
  it("同じ日の51件が50件のページ境界をまたいでも両ページに一日全体の金額を使える", () => {
    const transactions = [
      ...Array.from({ length: 50 }, () => ({
        date: "2026-10-05",
        amount: 100,
        type: "expense" as const,
      })),
      { date: "2026-10-05", amount: 12000, type: "income" as const },
      { date: "2026-10-04", amount: 700, type: "expense" as const },
    ];
    const totals = calculateDailyTotals(transactions);

    for (const pageItems of [transactions.slice(0, 50), transactions.slice(50)]) {
      const sameDayGroup = groupByDate(pageItems).find(
        (group) => group.date === "2026-10-05",
      );
      expect(sameDayGroup).toBeDefined();
      expect(totals.get(sameDayGroup!.date)).toEqual({
        income: 12000,
        expense: 5000,
      });
    }
    expect(totals.get("2026-10-04")).toEqual({ income: 0, expense: 700 });
  });

  it("絞り込み後に渡された収支だけを日計に含める", () => {
    const transactions = [
      { date: "2026-10-05", amount: 300, type: "expense" as const, category: "food" },
      { date: "2026-10-05", amount: 900, type: "expense" as const, category: "travel" },
      { date: "2026-10-04", amount: 500, type: "expense" as const, category: "food" },
    ];
    const totals = calculateDailyTotals(
      transactions.filter((transaction) => transaction.category === "food"),
    );
    expect(totals.get("2026-10-05")).toEqual({ income: 0, expense: 300 });
    expect(totals.get("2026-10-04")).toEqual({ income: 0, expense: 500 });
  });

  it("収支がない期間には日計を作らない", () => {
    expect(calculateDailyTotals([]).size).toBe(0);
  });
});
