import { AdviceSection } from "@/components/features/charts/advice-section";
import { AnalyticsViewTabs } from "@/components/features/charts/analytics-view-tabs";
import { CategoryBreakdown } from "@/components/features/charts/category-breakdown";
import { TrendBars } from "@/components/features/charts/trend-bars";
import { YoyComparison } from "@/components/features/charts/yoy-comparison";
import { MonthNav } from "@/components/features/transactions/month-nav";
import { CardContent } from "@/components/ui/card";
import { KpiRibbon } from "@/components/shared/kpi-ribbon";
import { PageHeader } from "@/components/shared/page-header";
import { SectionHeading } from "@/components/shared/section-heading";
import { Surface } from "@/components/shared/surface";
import { buildYearlyAdvice } from "@/lib/advice";
import { summarizeCategoryExpense, type TxLite } from "@/lib/analytics";
import type { ServerClient } from "@/lib/household";
import { getYearRanges, toISODate, type PeriodRange } from "@/lib/period";
import { fetchTransactionsInRange } from "@/lib/queries/transactions";
import { compareCategoryYoY, summarizeYear } from "@/lib/yearly-analytics";

type Props = {
  householdId: string;
  supabase: ServerClient;
  startDay: number;
  year: number;
};

/** txs のうち [start, end) に入るものだけを返す。 */
function within(txs: TxLite[], start: Date, end: Date): TxLite[] {
  const s = toISODate(start);
  const e = toISODate(end);
  return txs.filter((t) => t.date >= s && t.date < e);
}

function sumByType(txs: TxLite[], type: TxLite["type"]): number {
  return txs.reduce((sum, t) => (t.type === type ? sum + t.amount : sum), 0);
}

/**
 * 年間ビュー（spec 42）。締め日考慮の12期で年間集計し、前年同期と比較する。
 * 前年1期目〜当年末の24期ぶんを1回で取得して JS 側で振り分ける。
 */
export async function YearlyAnalyticsView({
  householdId,
  supabase,
  startDay,
  year,
}: Props) {
  const ranges = getYearRanges(year, startDay);
  const prevYearRanges = getYearRanges(year - 1, startDay);
  const yearStart = ranges[0].start;
  const yearEnd = ranges[11].end;

  const txs = await fetchTransactionsInRange(supabase, householdId, {
    start: prevYearRanges[0].start,
    end: yearEnd,
  });

  const today = toISODate(new Date());
  const summary = summarizeYear(txs, ranges, today);
  const currentTxs = within(txs, yearStart, yearEnd);
  const categories = summarizeCategoryExpense(currentTxs);

  // 前年同期: 当年の経過期数ぶんの前年（過去年なら前年まるごと）。
  const prevSpan: PeriodRange[] = prevYearRanges.slice(0, summary.elapsed);
  const prevTxs = prevSpan.length
    ? within(txs, prevSpan[0].start, prevSpan[prevSpan.length - 1].end)
    : [];
  const prevIncome = sumByType(prevTxs, "income");
  const prevExpense = sumByType(prevTxs, "expense");
  // 未来の期は当年側も0件のため、カテゴリ比較は当年全体 vs 前年同期でよい。
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

  const reveal =
    "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 ease-out";

  return (
    <main className="relative mx-auto w-full max-w-4xl space-y-6 overflow-hidden p-4 sm:py-8">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-8 -z-10 select-none font-heading text-[15rem] font-bold leading-none text-foreground/[0.035] sm:text-[18rem]"
      >
        ¥
      </span>

      <PageHeader
        eyebrow="Analytics · 家計の年鑑"
        title="分析"
        className={reveal}
        actions={
          <>
            <AnalyticsViewTabs active="year" />
            <MonthNav
              label={`${year}年`}
              prevHref={`/analytics?view=year&year=${year - 1}`}
              nextHref={`/analytics?view=year&year=${year + 1}`}
            />
          </>
        }
      />

      <div className={reveal} style={{ animationDelay: "60ms" }}>
        <KpiRibbon items={kpis} />
      </div>

      {advice.length > 0 ? (
        <section className={reveal} style={{ animationDelay: "90ms" }}>
          <SectionHeading>年間アドバイス</SectionHeading>
          <Surface variant="raised">
            <CardContent className="py-5">
              <AdviceSection advice={advice} />
            </CardContent>
          </Surface>
        </section>
      ) : null}

      <section className={reveal} style={{ animationDelay: "120ms" }}>
        <SectionHeading index={1}>月別推移（12期）</SectionHeading>
        <Surface variant="raised">
          <CardContent className="py-5">
            <TrendBars data={summary.months} />
          </CardContent>
        </Surface>
      </section>

      <section
        className={reveal}
        style={{ animationDelay: "180ms" }}
        aria-label="カテゴリ別支出（年間）"
      >
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

      <section
        className={reveal}
        style={{ animationDelay: "240ms" }}
        aria-label="前年比較"
      >
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
