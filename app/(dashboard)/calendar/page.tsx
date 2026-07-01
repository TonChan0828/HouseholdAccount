import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import {
  CalendarBoard,
  type CalendarTx,
} from "@/components/features/calendar/calendar-board";
import { SummaryCards } from "@/components/features/dashboard/summary-cards";
import { MonthNav } from "@/components/features/transactions/month-nav";
import { ViewToggle } from "@/components/features/transactions/view-toggle";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import {
  buildCalendarWeeks,
  formatMonthLabel,
  getCalendarGridRange,
  getCalendarMonthRange,
  shiftMonth,
  summarizeDailyTotals,
} from "@/lib/calendar";
import { getActiveHouseholdId, getCurrentUser } from "@/lib/household";
import { refFromParam, toISODate } from "@/lib/period";
import { ensureRecurringGenerated } from "@/lib/recurring";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type TxRow = {
  id: string;
  amount: number;
  type: "income" | "expense";
  date: string;
  memo: string | null;
  created_by: string;
  category: { name: string; color: string | null } | null;
};

export default async function CalendarPage({
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

  // 当期分の定期収支を（未生成なら）生成してから取得する。冪等。
  await ensureRecurringGenerated(householdId);

  const refDate = refFromParam(ref);
  const grid = getCalendarGridRange(refDate);
  const month = getCalendarMonthRange(refDate);

  const { data } = await supabase
    .from("transactions")
    .select("id, amount, type, date, memo, created_by, category:categories(name, color)")
    .eq("household_id", householdId)
    .gte("date", toISODate(grid.start))
    .lt("date", toISODate(grid.end))
    .order("date", { ascending: true })
    .order("created_at", { ascending: true })
    .overrideTypes<TxRow[]>();

  const txs = data ?? [];

  const weeks = buildCalendarWeeks(refDate, summarizeDailyTotals(txs));

  // 当月分のみ集計・明細化する（埋め日の収支はセル表示のみ）。
  const monthStart = toISODate(month.start);
  const monthEnd = toISODate(month.end);
  const inMonth = (d: string) => d >= monthStart && d < monthEnd;

  let income = 0;
  let expense = 0;
  const transactionsByDate: Record<string, CalendarTx[]> = {};
  for (const t of txs) {
    if (!inMonth(t.date)) continue;
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
    (transactionsByDate[t.date] ??= []).push({
      id: t.id,
      amount: t.amount,
      type: t.type,
      memo: t.memo,
      category: t.category,
    });
  }

  const todayIso = toISODate(new Date());
  const initialSelected = inMonth(todayIso) ? todayIso : monthStart;

  const prevHref = `/calendar?ref=${toISODate(shiftMonth(refDate, -1))}`;
  const nextHref = `/calendar?ref=${toISODate(shiftMonth(refDate, 1))}`;

  const reveal =
    "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 ease-out";

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:py-8 lg:max-w-6xl">
      <PageHeader
        eyebrow="記録"
        title="カレンダー"
        meta={formatMonthLabel(refDate)}
        className={reveal}
        actions={
          <>
            <ViewToggle active="calendar" />
            <MonthNav
              label={formatMonthLabel(refDate)}
              prevHref={prevHref}
              nextHref={nextHref}
            />
            <Link
              href="/transactions/new"
              className={cn(
                buttonVariants({ variant: "default", size: "sm" }),
                "hidden sm:inline-flex",
              )}
            >
              <Plus className="size-4" aria-hidden />
              収支を追加
            </Link>
          </>
        }
      />

      <div className={reveal} style={{ animationDelay: "120ms" }}>
        <CalendarBoard
          weeks={weeks}
          transactionsByDate={transactionsByDate}
          initialSelected={initialSelected}
          side={<SummaryCards income={income} expense={expense} />}
        />
      </div>
    </main>
  );
}
