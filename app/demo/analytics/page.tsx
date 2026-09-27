"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { useDemo } from "@/components/features/demo/demo-provider";
import { AdviceSection } from "@/components/features/charts/advice-section";
import { CategoryBreakdown } from "@/components/features/charts/category-breakdown";
import { TrendBars } from "@/components/features/charts/trend-bars";
import { YoyComparison } from "@/components/features/charts/yoy-comparison";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { KpiRibbon } from "@/components/shared/kpi-ribbon";
import { PageHeader } from "@/components/shared/page-header";
import { SectionHeading } from "@/components/shared/section-heading";
import { Surface } from "@/components/shared/surface";
import { buildYearlyAdvice } from "@/lib/advice";
import { summarizeCategoryExpense, type TxLite } from "@/lib/analytics";
import { getYearRanges, toISODate, type PeriodRange } from "@/lib/period";
import { compareCategoryYoY, summarizeYear } from "@/lib/yearly-analytics";

function within(txs: TxLite[], range: PeriodRange): TxLite[] {
  const start = toISODate(range.start);
  const end = toISODate(range.end);
  return txs.filter((tx) => tx.date >= start && tx.date < end);
}

function sumByType(txs: TxLite[], type: TxLite["type"]): number {
  return txs.reduce((sum, tx) => (tx.type === type ? sum + tx.amount : sum), 0);
}

/** デモ用の年間分析。年次集計の純粋ロジックと表示部品を本番と共有する。 */
export default function DemoAnalyticsPage() {
  const { household, rows } = useDemo();
  const [year, setYear] = useState(() => new Date().getUTCFullYear());

  const txs: TxLite[] = rows.map((row) => ({
    amount: row.amount,
    type: row.type,
    date: row.date,
    category_id: row.category_id,
    category: row.category,
  }));
  const ranges = getYearRanges(year, household.period_start_day);
  const prevRanges = getYearRanges(year - 1, household.period_start_day);
  const today = toISODate(new Date());
  const summary = summarizeYear(txs, ranges, today);
  const yearTxs = ranges.flatMap((range) => within(txs, range));
  const categories = summarizeCategoryExpense(yearTxs);
  const prevSpan = prevRanges.slice(0, summary.elapsed);
  const prevTxs = prevSpan.length
    ? within(txs, {
        start: prevSpan[0].start,
        end: prevSpan[prevSpan.length - 1].end,
      })
    : [];
  const prevIncome = sumByType(prevTxs, "income");
  const prevExpense = sumByType(prevTxs, "expense");
  const categoryYoY = compareCategoryYoY(
    categories,
    summarizeCategoryExpense(prevTxs),
  );
  const compareLabel =
    summary.elapsed >= 12
      ? `${year - 1}年`
      : `${year - 1}年 1月〜${summary.elapsed}月`;
  const advice = buildYearlyAdvice({
    income: summary.income,
    expense: summary.expense,
    prevIncome,
    prevExpense,
    elapsed: summary.elapsed,
    avgExpense: summary.avgExpense,
    peakExpense: summary.peakExpense,
    categoryYoY,
  });
  const kpis = [
    { label: "年間収入", value: summary.income, format: "yen" as const },
    { label: "年間支出", value: summary.expense, format: "yen" as const },
    { label: "年間収支", value: summary.balance, format: "yen" as const },
    {
      label: "貯蓄率",
      value:
        summary.savingsRate === null
          ? 0
          : Math.round(summary.savingsRate * 100),
      unit: "%",
    },
  ];

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:py-8">
      <PageHeader
        eyebrow="Analytics · 家計の年鑑"
        title="分析"
        actions={
          <div className="flex w-full items-center gap-1 rounded-full border bg-card/70 p-1 shadow-soft ring-1 ring-foreground/5 sm:w-auto">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="前年"
              onClick={() => setYear((current) => current - 1)}
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Button>
            <span className="min-w-0 flex-1 text-center font-heading text-sm font-semibold tabular-nums sm:min-w-36 sm:flex-none">
              {year}年
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="翌年"
              onClick={() => setYear((current) => current + 1)}
            >
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
        }
      />

      <KpiRibbon items={kpis} />

      {advice.length > 0 ? (
        <section>
          <SectionHeading>年間アドバイス</SectionHeading>
          <Surface variant="raised">
            <CardContent className="py-5">
              <AdviceSection advice={advice} />
            </CardContent>
          </Surface>
        </section>
      ) : null}

      <section>
        <SectionHeading index={1}>月別推移（12期）</SectionHeading>
        <Surface variant="raised">
          <CardContent className="py-5">
            <TrendBars data={summary.months} />
          </CardContent>
        </Surface>
      </section>

      <section aria-label="カテゴリ別支出（年間）">
        <SectionHeading index={2}>カテゴリ別支出（年間）</SectionHeading>
        <Surface variant="raised">
          <CardContent className="py-5">
            <CategoryBreakdown
              data={categories}
              emptyMessage="この年の支出はまだありません。"
            />
          </CardContent>
        </Surface>
      </section>

      <section aria-label="前年比較">
        <SectionHeading index={3}>前年比較</SectionHeading>
        <Surface variant="raised">
          <CardContent className="py-5">
            <YoyComparison
              income={summary.income}
              expense={summary.expense}
              prevIncome={prevIncome}
              prevExpense={prevExpense}
              rows={categoryYoY}
              compareLabel={compareLabel}
            />
          </CardContent>
        </Surface>
      </section>
    </main>
  );
}
