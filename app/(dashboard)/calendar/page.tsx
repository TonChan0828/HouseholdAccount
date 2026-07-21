import {
  CalendarBoard,
  type CalendarTx,
} from "@/components/features/calendar/calendar-board";
import { SummaryCards } from "@/components/features/dashboard/summary-cards";
import { MonthNav } from "@/components/features/transactions/month-nav";
import {
  NewTransactionButton,
  TransactionDialogProvider,
} from "@/components/features/transactions/transaction-dialog";
import { ViewToggle } from "@/components/features/transactions/view-toggle";
import { PageHeader } from "@/components/shared/page-header";
import {
  buildCalendarWeeks,
  formatMonthLabel,
  getCalendarGridRange,
  getCalendarMonthRange,
  shiftMonth,
  summarizeDailyTotals,
} from "@/lib/calendar";
import { getUserHouseholds, requireDashboardContext } from "@/lib/household";
import { refFromParam, toISODate } from "@/lib/period";
import { fetchHouseholdCategories } from "@/lib/queries/categories";
import { fetchTransactionsInRange } from "@/lib/queries/transactions";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  const { user, householdId, supabase } = await requireDashboardContext();

  const refDate = refFromParam(ref);
  const grid = getCalendarGridRange(refDate);
  const month = getCalendarMonthRange(refDate);

  // 明細から編集ダイアログ（spec 40）を開けるよう、カテゴリと所属グループも揃える。
  const [txs, categories, households] = await Promise.all([
    fetchTransactionsInRange(supabase, householdId, grid, { order: "asc" }),
    fetchHouseholdCategories(supabase, householdId),
    getUserHouseholds(),
  ]);
  const otherHouseholds = households.filter((h) => h.id !== householdId);

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
      date: t.date,
      memo: t.memo,
      category: t.category,
      category_id: t.category_id,
      created_by: t.created_by,
      is_shared: t.is_shared,
    });
  }

  const todayIso = toISODate(new Date());
  const initialSelected = inMonth(todayIso) ? todayIso : monthStart;

  const prevHref = `/calendar?ref=${toISODate(shiftMonth(refDate, -1))}`;
  const nextHref = `/calendar?ref=${toISODate(shiftMonth(refDate, 1))}`;

  const reveal =
    "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 ease-out";

  return (
    <TransactionDialogProvider
      categories={categories}
      otherHouseholds={otherHouseholds}
    >
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
              <NewTransactionButton className="hidden sm:inline-flex" />
            </>
          }
        />

        <div className={reveal} style={{ animationDelay: "120ms" }}>
          <CalendarBoard
            weeks={weeks}
            transactionsByDate={transactionsByDate}
            initialSelected={initialSelected}
            currentUserId={user.id}
            side={<SummaryCards income={income} expense={expense} />}
          />
        </div>
      </main>
    </TransactionDialogProvider>
  );
}
