import { AdviceSection } from "@/components/features/charts/advice-section";
import { CategoryBreakdown } from "@/components/features/charts/category-breakdown";
import { TrendBars } from "@/components/features/charts/trend-bars";
import { MonthNav } from "@/components/features/transactions/month-nav";
import { CardContent } from "@/components/ui/card";
import { KpiRibbon } from "@/components/shared/kpi-ribbon";
import { PageHeader } from "@/components/shared/page-header";
import { SectionHeading } from "@/components/shared/section-heading";
import { Surface } from "@/components/shared/surface";
import { buildAdvice } from "@/lib/advice";
import {
  summarizeCategoryExpense,
  summarizeCategoryTrend,
  summarizeTrend,
  type TxLite,
} from "@/lib/analytics";
import { buildBudgetRows } from "@/lib/budget";
import {
  getHouseholdSettings,
  requireDashboardContext,
} from "@/lib/household";
import {
  formatPeriodLabel,
  getPeriodRange,
  shiftPeriod,
  toISODate,
} from "@/lib/period";

const TREND_PERIODS = 6;

function refFromParam(ref: string | undefined): Date {
  if (ref && /^\d{4}-\d{2}-\d{2}$/.test(ref)) {
    return new Date(`${ref}T00:00:00Z`);
  }
  return new Date();
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  const { householdId, supabase } = await requireDashboardContext();

  const { periodStartDay: startDay } = await getHouseholdSettings(householdId);

  const base = getPeriodRange(refFromParam(ref), startDay);
  const ranges = Array.from({ length: TREND_PERIODS }, (_, i) =>
    shiftPeriod(base, i - (TREND_PERIODS - 1), startDay),
  );
  const isoStart = toISODate(ranges[0].start);
  const baseStart = toISODate(base.start);
  const baseEnd = toISODate(base.end);

  const [
    { data },
    { data: budgetData },
    { data: categoryData },
    { data: recurringData },
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select("amount, type, date, category_id, category:categories(name, color)")
      .eq("household_id", householdId)
      .gte("date", isoStart)
      .lt("date", baseEnd)
      .overrideTypes<TxLite[]>(),
    supabase
      .from("budgets")
      .select("category_id, amount")
      .eq("household_id", householdId),
    supabase
      .from("categories")
      .select("id, name, color")
      .eq("household_id", householdId),
    supabase
      .from("recurring_transactions")
      .select("category_id, type")
      .eq("household_id", householdId)
      .eq("is_active", true),
  ]);

  const txs = data ?? [];
  const trend = summarizeTrend(txs, ranges);
  const categories = summarizeCategoryExpense(
    txs.filter((t) => t.date >= baseStart && t.date < baseEnd),
  );

  // 家計アドバイス（ルールベース）の入力を組み立てる。
  const budget = buildBudgetRows(
    budgetData ?? [],
    categories,
    categoryData ?? [],
  );
  // 定期支出に紐づくカテゴリは固定費とみなし、集中度判定から除外する。
  const fixedCategoryIds = (recurringData ?? [])
    .filter((r) => r.type === "expense" && r.category_id)
    .map((r) => r.category_id as string);
  const currentPeriod = trend[trend.length - 1];
  const prevPeriod = trend[trend.length - 2];
  const advice = buildAdvice({
    income: currentPeriod.income,
    expense: currentPeriod.expense,
    prevIncome: prevPeriod?.income ?? 0,
    prevExpense: prevPeriod?.expense ?? 0,
    expenseTrend: trend.map((t) => t.expense),
    categories,
    fixedCategoryIds,
    categoryTrends: summarizeCategoryTrend(txs, ranges),
    budget,
  });

  // KPI（テスト衝突回避のため当期支出合計・収支・カテゴリ名は本文に重複させない）。
  const totalExpense = categories.reduce((s, c) => s + c.amount, 0) || 1;
  const avgExpense = Math.round(
    trend.reduce((s, t) => s + t.expense, 0) / trend.length,
  );
  const topShare = categories.length
    ? Math.round((categories[0].amount / totalExpense) * 100)
    : 0;

  const kpis = [
    { label: "当期収入", value: currentPeriod.income, format: "yen" as const },
    { label: "支出カテゴリ", value: categories.length, unit: "件" },
    { label: "最多占有", value: topShare, unit: "%" },
    { label: "月平均支出", value: avgExpense, format: "yen" as const },
  ];

  const prevHref = `/analytics?ref=${toISODate(shiftPeriod(base, -1, startDay).start)}`;
  const nextHref = `/analytics?ref=${toISODate(shiftPeriod(base, 1, startDay).start)}`;

  const reveal =
    "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 ease-out";

  return (
    <main className="relative mx-auto w-full max-w-4xl space-y-6 overflow-hidden p-4 sm:py-8">
      {/* エディトリアルな装飾ウォーターマーク */}
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
          <MonthNav
            label={formatPeriodLabel(base)}
            prevHref={prevHref}
            nextHref={nextHref}
          />
        }
      />

      {/* KPI リボン */}
      <div className={reveal} style={{ animationDelay: "60ms" }}>
        <KpiRibbon items={kpis} />
      </div>

      {/* 家計アドバイス（ルールベース） */}
      {advice.length > 0 ? (
        <section className={reveal} style={{ animationDelay: "90ms" }}>
          <SectionHeading>家計アドバイス</SectionHeading>
          <Surface variant="raised">
            <CardContent className="py-5">
              <AdviceSection advice={advice} />
            </CardContent>
          </Surface>
        </section>
      ) : null}

      {/* カテゴリ別支出（showpiece） */}
      <section className={reveal} style={{ animationDelay: "120ms" }}>
        <SectionHeading index={1}>カテゴリ別支出（当期）</SectionHeading>
        <Surface variant="raised">
          <CardContent className="py-5">
            <CategoryBreakdown data={categories} />
          </CardContent>
        </Surface>
      </section>

      {/* 月別推移 */}
      <section className={reveal} style={{ animationDelay: "180ms" }}>
        <SectionHeading index={2}>月別推移（直近6期）</SectionHeading>
        <Surface variant="raised">
          <CardContent className="py-5">
            <TrendBars data={trend} />
          </CardContent>
        </Surface>
      </section>
    </main>
  );
}
