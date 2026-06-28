/**
 * カレンダービューの暦月グリッド計算と日次集計（純関数）。
 *
 * 期間は半開区間 `[start, end)`。TZ 揺れを避けるため、`lib/period.ts` と同様に
 * すべて UTC 真夜中の Date として扱う（DB の `date` 型は時刻を持たない）。
 * カレンダーは暦通りの月（1日〜末日）・日曜始まり。
 */

import { toISODate } from "@/lib/period";

const DAY_MS = 24 * 60 * 60 * 1000;

export type DailyTotal = { income: number; expense: number };

export type CalendarDay = {
  date: string; // YYYY-MM-DD
  inMonth: boolean; // 当月か（前後月の埋め日は false）
  income: number;
  expense: number;
};

/** ref を含む暦月の範囲（当月1日〜翌月1日）。 */
export function getCalendarMonthRange(ref: Date): { start: Date; end: Date } {
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth();
  return {
    start: new Date(Date.UTC(y, m, 1)),
    end: new Date(Date.UTC(y, m + 1, 1)),
  };
}

/** 当月を覆う完全週（月初を含む週の日曜〜月末を含む週の翌日曜）の範囲。 */
export function getCalendarGridRange(ref: Date): { start: Date; end: Date } {
  const month = getCalendarMonthRange(ref);

  // グリッド開始: 月初を含む週の日曜（getUTCDay: 0=日）。
  const start = new Date(month.start);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());

  // グリッド終了(排他): 月末を含む週の土曜の翌日（＝次の日曜）。
  const lastDay = new Date(month.end.getTime() - DAY_MS);
  const end = new Date(lastDay);
  end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()) + 1);

  return { start, end };
}

/** 日付ごとに収入・支出を分離して合算する。 */
export function summarizeDailyTotals(
  txs: { date: string; type: "income" | "expense"; amount: number }[],
): Map<string, DailyTotal> {
  const map = new Map<string, DailyTotal>();
  for (const t of txs) {
    const cur = map.get(t.date) ?? { income: 0, expense: 0 };
    if (t.type === "income") cur.income += t.amount;
    else cur.expense += t.amount;
    map.set(t.date, cur);
  }
  return map;
}

/** グリッド範囲を週×日の2次元配列にし、日次合計を埋める。 */
export function buildCalendarWeeks(
  ref: Date,
  totals: Map<string, DailyTotal>,
): CalendarDay[][] {
  const month = getCalendarMonthRange(ref);
  const grid = getCalendarGridRange(ref);

  const weeks: CalendarDay[][] = [];
  let cursor = new Date(grid.start);
  while (cursor < grid.end) {
    const week: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      const date = toISODate(cursor);
      const total = totals.get(date) ?? { income: 0, expense: 0 };
      week.push({
        date,
        inMonth: cursor >= month.start && cursor < month.end,
        income: total.income,
        expense: total.expense,
      });
      cursor = new Date(cursor.getTime() + DAY_MS);
    }
    weeks.push(week);
  }
  return weeks;
}

/** ref から delta 月ぶん移動した月初の Date を返す。 */
export function shiftMonth(ref: Date, delta: number): Date {
  return new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + delta, 1));
}

/** 「YYYY年M月」形式の月ラベル。 */
export function formatMonthLabel(ref: Date): string {
  return `${ref.getUTCFullYear()}年${ref.getUTCMonth() + 1}月`;
}
