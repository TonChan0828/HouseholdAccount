/**
 * 年間分析の集計ロジック（純関数）。
 *
 * 年は締め日考慮の12期（`getYearRanges`）で、月次と同じく JS 側で集計する。
 * 期の集計は `lib/analytics.ts` の summarizeTrend を再利用し、ラベルだけ「N月」にする。
 */

import {
  summarizeTrend,
  type CategorySlice,
  type PeriodSummary,
  type TxLite,
} from "@/lib/analytics";
import { toISODate, type PeriodRange } from "@/lib/period";

export type YearSummary = {
  /** 12期（label: "1月"〜"12月"・期の開始月）。 */
  months: PeriodSummary[];
  income: number;
  expense: number;
  /** income - expense */
  balance: number;
  /** income > 0 のとき (income - expense) / income。 */
  savingsRate: number | null;
  /** 経過期数（0〜12）。 */
  elapsed: number;
  /** 経過期あたりの支出（四捨五入）。経過0なら 0。 */
  avgExpense: number;
  /** 支出最多の期。支出が無ければ null。 */
  peakExpense: { label: string; amount: number } | null;
};

/** カテゴリ別の前年（同期）比較の1行。 */
export type CategoryYoY = {
  categoryId: string | null;
  name: string;
  color: string;
  amount: number;
  prevAmount: number;
  /** amount - prevAmount */
  diff: number;
  /** prevAmount > 0 のとき diff / prevAmount。 */
  ratio: number | null;
};

/** 開始日が today（YYYY-MM-DD）以前の期の数。期の途中も経過扱い。 */
export function countElapsed(ranges: PeriodRange[], today: string): number {
  return ranges.filter((r) => toISODate(r.start) <= today).length;
}

/** 12期の推移と年間合計・貯蓄率・月平均・支出最多月を集計する。 */
export function summarizeYear(
  txs: TxLite[],
  ranges: PeriodRange[],
  today: string,
): YearSummary {
  const months = summarizeTrend(txs, ranges).map((m, i) => ({
    ...m,
    label: `${ranges[i].start.getUTCMonth() + 1}月`,
  }));
  const income = months.reduce((s, m) => s + m.income, 0);
  const expense = months.reduce((s, m) => s + m.expense, 0);
  const elapsed = countElapsed(ranges, today);

  let peakExpense: YearSummary["peakExpense"] = null;
  for (const m of months) {
    if (m.expense > 0 && (!peakExpense || m.expense > peakExpense.amount)) {
      peakExpense = { label: m.label, amount: m.expense };
    }
  }

  return {
    months,
    income,
    expense,
    balance: income - expense,
    savingsRate: income > 0 ? (income - expense) / income : null,
    elapsed,
    avgExpense: elapsed > 0 ? Math.round(expense / elapsed) : 0,
    peakExpense,
  };
}

/** 当年と前年のカテゴリ別支出を突き合わせ、差額の絶対値降順で返す（差額0は除外）。 */
export function compareCategoryYoY(
  current: CategorySlice[],
  prev: CategorySlice[],
): CategoryYoY[] {
  const rows = new Map<string, CategoryYoY>();
  const keyOf = (c: CategorySlice) => c.categoryId ?? "__none__";

  for (const c of current) {
    rows.set(keyOf(c), {
      categoryId: c.categoryId,
      name: c.name,
      color: c.color,
      amount: c.amount,
      prevAmount: 0,
      diff: 0,
      ratio: null,
    });
  }
  for (const p of prev) {
    const row = rows.get(keyOf(p));
    if (row) {
      row.prevAmount = p.amount;
    } else {
      rows.set(keyOf(p), {
        categoryId: p.categoryId,
        name: p.name,
        color: p.color,
        amount: 0,
        prevAmount: p.amount,
        diff: 0,
        ratio: null,
      });
    }
  }

  return [...rows.values()]
    .map((r) => {
      const diff = r.amount - r.prevAmount;
      return {
        ...r,
        diff,
        ratio: r.prevAmount > 0 ? diff / r.prevAmount : null,
      };
    })
    .filter((r) => r.diff !== 0)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
}
