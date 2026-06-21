import { redirect } from "next/navigation";

import { CategoryBreakdown } from "@/components/features/charts/category-breakdown";
import { TrendBars } from "@/components/features/charts/trend-bars";
import { MonthNav } from "@/components/features/transactions/month-nav";
import { Card, CardContent } from "@/components/ui/card";
import {
  summarizeCategoryExpense,
  summarizeTrend,
  type TxLite,
} from "@/lib/analytics";
import { yen } from "@/lib/format";
import {
  getActiveHouseholdId,
  getCurrentUser,
  getHouseholdSettings,
} from "@/lib/household";
import {
  formatPeriodLabel,
  getPeriodRange,
  shiftPeriod,
  toISODate,
} from "@/lib/period";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

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

  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const householdId = await getActiveHouseholdId();
  if (!householdId) {
    redirect("/households");
  }

  const { periodStartDay: startDay } = await getHouseholdSettings(householdId);

  const base = getPeriodRange(refFromParam(ref), startDay);
  const ranges = Array.from({ length: TREND_PERIODS }, (_, i) =>
    shiftPeriod(base, i - (TREND_PERIODS - 1), startDay),
  );
  const isoStart = toISODate(ranges[0].start);
  const baseStart = toISODate(base.start);
  const baseEnd = toISODate(base.end);

  const { data } = await supabase
    .from("transactions")
    .select("amount, type, date, category_id, category:categories(name, color)")
    .eq("household_id", householdId)
    .gte("date", isoStart)
    .lt("date", baseEnd)
    .overrideTypes<TxLite[]>();

  const txs = data ?? [];
  const trend = summarizeTrend(txs, ranges);
  const categories = summarizeCategoryExpense(
    txs.filter((t) => t.date >= baseStart && t.date < baseEnd),
  );

  // KPI（テスト衝突回避のため当期支出合計・収支・カテゴリ名は本文に重複させない）。
  const current = trend[trend.length - 1];
  const totalExpense = categories.reduce((s, c) => s + c.amount, 0) || 1;
  const avgExpense = Math.round(
    trend.reduce((s, t) => s + t.expense, 0) / trend.length,
  );
  const topShare = categories.length
    ? Math.round((categories[0].amount / totalExpense) * 100)
    : 0;

  const kpis = [
    { label: "当期収入", value: yen(current.income) },
    { label: "支出カテゴリ", value: `${categories.length}`, unit: "件" },
    { label: "最多占有", value: `${topShare}`, unit: "%" },
    { label: "月平均支出", value: yen(avgExpense) },
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

      <header className={cn("space-y-2", reveal)}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Analytics · 家計の年鑑
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            分析
          </h1>
          <MonthNav
            label={formatPeriodLabel(base)}
            prevHref={prevHref}
            nextHref={nextHref}
          />
        </div>
      </header>

      {/* KPI リボン */}
      <Card
        className={cn("relative overflow-hidden py-0 shadow-soft ring-0", reveal)}
        style={{ animationDelay: "60ms" }}
      >
        <CardContent className="grid grid-cols-2 gap-px bg-border/60 px-0 sm:grid-cols-4">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="flex flex-col gap-1 bg-card p-4 sm:p-5"
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {kpi.label}
              </span>
              <span className="font-heading text-2xl font-bold tabular-nums">
                {kpi.value}
                {kpi.unit ? (
                  <span className="ml-0.5 text-sm text-muted-foreground">
                    {kpi.unit}
                  </span>
                ) : null}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* カテゴリ別支出（showpiece） */}
      <section className={reveal} style={{ animationDelay: "120ms" }}>
        <div className="mb-2 flex items-end gap-3">
          <span className="font-heading text-xs font-bold tabular-nums text-primary">
            01
          </span>
          <h2 className="font-heading text-base font-bold">
            カテゴリ別支出（当期）
          </h2>
          <span className="mb-1.5 h-px flex-1 bg-border/70" aria-hidden />
        </div>
        <Card className="shadow-soft ring-0">
          <CardContent className="py-5">
            <CategoryBreakdown data={categories} />
          </CardContent>
        </Card>
      </section>

      {/* 月別推移 */}
      <section className={reveal} style={{ animationDelay: "180ms" }}>
        <div className="mb-2 flex items-end gap-3">
          <span className="font-heading text-xs font-bold tabular-nums text-primary">
            02
          </span>
          <h2 className="font-heading text-base font-bold">
            月別推移（直近6期）
          </h2>
          <span className="mb-1.5 h-px flex-1 bg-border/70" aria-hidden />
        </div>
        <Card className="shadow-soft ring-0">
          <CardContent className="py-5">
            <TrendBars data={trend} />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
