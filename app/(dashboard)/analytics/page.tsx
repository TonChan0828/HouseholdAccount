import Link from "next/link";
import { redirect } from "next/navigation";

import { CategoryPieChart } from "@/components/features/charts/category-pie-chart";
import { TrendBarChart } from "@/components/features/charts/trend-bar-chart";
import { MonthNav } from "@/components/features/transactions/month-nav";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  summarizeCategoryExpense,
  summarizeTrend,
  type TxLite,
} from "@/lib/analytics";
import { getActiveHouseholdId } from "@/lib/household";
import {
  formatPeriodLabel,
  getPeriodRange,
  shiftPeriod,
  toISODate,
} from "@/lib/period";
import { createClient } from "@/lib/supabase/server";

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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const householdId = await getActiveHouseholdId();
  if (!householdId) {
    redirect("/households");
  }

  const { data: household } = await supabase
    .from("households")
    .select("period_start_day")
    .eq("id", householdId)
    .maybeSingle();
  const startDay = household?.period_start_day ?? 1;

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

  const prevHref = `/analytics?ref=${toISODate(shiftPeriod(base, -1, startDay).start)}`;
  const nextHref = `/analytics?ref=${toISODate(shiftPeriod(base, 1, startDay).start)}`;

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 p-4 sm:py-8">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">分析</h1>
        <Link
          href="/households"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          グループ選択
        </Link>
      </div>

      <MonthNav
        label={formatPeriodLabel(base)}
        prevHref={prevHref}
        nextHref={nextHref}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">月別推移（直近6期）</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendBarChart data={trend} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">カテゴリ別支出（当期）</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryPieChart data={categories} />
        </CardContent>
      </Card>

      <div className="text-center">
        <Link href="/" className={buttonVariants({ variant: "link" })}>
          ダッシュボードへ
        </Link>
      </div>
    </main>
  );
}
