import { describe, expect, it } from "vitest";

import {
  buildCalendarWeeks,
  formatMonthLabel,
  getCalendarGridRange,
  getCalendarMonthRange,
  shiftMonth,
  summarizeDailyTotals,
  type DailyTotal,
} from "./calendar";
import { toISODate } from "./period";

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

const tx = (over: {
  date: string;
  type?: "income" | "expense";
  amount?: number;
}) => ({
  type: "expense" as "income" | "expense",
  amount: 0,
  ...over,
});

describe("getCalendarMonthRange", () => {
  it("当月1日〜翌月1日の半開区間を返す", () => {
    const { start, end } = getCalendarMonthRange(utc("2026-06-15"));
    expect(toISODate(start)).toBe("2026-06-01");
    expect(toISODate(end)).toBe("2026-07-01");
  });

  it("年跨ぎ（12月）も正しく扱う", () => {
    const { start, end } = getCalendarMonthRange(utc("2026-12-10"));
    expect(toISODate(start)).toBe("2026-12-01");
    expect(toISODate(end)).toBe("2027-01-01");
  });
});

describe("getCalendarGridRange", () => {
  it("月初を含む週の日曜から、月末を含む週の翌日曜までの完全週を返す", () => {
    // 2026-06-01 は月曜なので、グリッドは前週日曜 2026-05-31 から始まる。
    const { start, end } = getCalendarGridRange(utc("2026-06-15"));
    expect(toISODate(start)).toBe("2026-05-31");
    expect(toISODate(end)).toBe("2026-07-05");
    expect(start.getUTCDay()).toBe(0); // 日曜始まり
    expect(end.getUTCDay()).toBe(0); // 排他境界も日曜
  });

  it("常に7日の倍数の長さになる", () => {
    const { start, end } = getCalendarGridRange(utc("2026-02-15"));
    const days = (end.getTime() - start.getTime()) / (24 * 3600 * 1000);
    expect(days % 7).toBe(0);
  });
});

describe("summarizeDailyTotals", () => {
  it("日付ごとに収入・支出を分離して合算する", () => {
    const totals = summarizeDailyTotals([
      tx({ date: "2026-06-10", type: "income", amount: 1000 }),
      tx({ date: "2026-06-10", type: "expense", amount: 300 }),
      tx({ date: "2026-06-10", type: "expense", amount: 200 }),
      tx({ date: "2026-06-11", type: "income", amount: 500 }),
    ]);
    expect(totals.get("2026-06-10")).toEqual<DailyTotal>({
      income: 1000,
      expense: 500,
    });
    expect(totals.get("2026-06-11")).toEqual<DailyTotal>({
      income: 500,
      expense: 0,
    });
  });
});

describe("buildCalendarWeeks", () => {
  it("週×日の2次元配列を作り、各週7日になる", () => {
    const weeks = buildCalendarWeeks(utc("2026-06-15"), new Map());
    expect(weeks).toHaveLength(5);
    for (const week of weeks) expect(week).toHaveLength(7);
  });

  it("先頭セルは前月の埋め日（inMonth=false）、月初はinMonth=true", () => {
    const weeks = buildCalendarWeeks(utc("2026-06-15"), new Map());
    expect(weeks[0][0]).toMatchObject({ date: "2026-05-31", inMonth: false });
    expect(weeks[0][1]).toMatchObject({ date: "2026-06-01", inMonth: true });
  });

  it("日次合計をセルへ反映する", () => {
    const totals = new Map<string, DailyTotal>([
      ["2026-06-01", { income: 1000, expense: 200 }],
    ]);
    const weeks = buildCalendarWeeks(utc("2026-06-15"), totals);
    expect(weeks[0][1]).toMatchObject({
      date: "2026-06-01",
      income: 1000,
      expense: 200,
    });
  });
});

describe("shiftMonth", () => {
  it("delta月ぶん移動した月初を返す", () => {
    expect(toISODate(shiftMonth(utc("2026-06-15"), -1))).toBe("2026-05-01");
    expect(toISODate(shiftMonth(utc("2026-12-15"), 1))).toBe("2027-01-01");
  });
});

describe("formatMonthLabel", () => {
  it("「YYYY年M月」形式で返す", () => {
    expect(formatMonthLabel(utc("2026-06-15"))).toBe("2026年6月");
  });
});
