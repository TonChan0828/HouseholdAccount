import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ReceiptText } from "lucide-react";

import { ScopeToggle, type DashboardScope } from "@/components/features/dashboard/scope-toggle";
import { SummaryCards } from "@/components/features/dashboard/summary-cards";
import { CategoryBadge } from "@/components/features/transactions/category-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDayLabel, groupByDate, yen } from "@/lib/format";
import { getActiveHouseholdId } from "@/lib/household";
import {
  formatPeriodLabel,
  getPeriodRange,
  shiftPeriod,
  toISODate,
} from "@/lib/period";
import { createClient } from "@/lib/supabase/server";

type TransactionRow = {
  id: string;
  amount: number;
  type: "income" | "expense";
  date: string;
  memo: string | null;
  created_by: string;
  category: { name: string; color: string | null } | null;
};

const RECENT_LIMIT = 5;

function scopeFromParam(scope: string | undefined): DashboardScope {
  return scope === "mine" ? "mine" : "all";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const { scope: scopeParam } = await searchParams;
  const scope = scopeFromParam(scopeParam);

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

  const range = getPeriodRange(new Date(), startDay);
  const prevRange = shiftPeriod(range, -1, startDay);

  const buildQuery = (start: Date, end: Date) => {
    let query = supabase
      .from("transactions")
      .select("id, amount, type, date, memo, created_by, category:categories(name, color)")
      .eq("household_id", householdId)
      .gte("date", toISODate(start))
      .lt("date", toISODate(end))
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    if (scope === "mine") {
      query = query.eq("created_by", user.id);
    }
    return query;
  };

  const [{ data }, { data: prevData }] = await Promise.all([
    buildQuery(range.start, range.end).overrideTypes<TransactionRow[]>(),
    buildQuery(prevRange.start, prevRange.end).overrideTypes<TransactionRow[]>(),
  ]);

  const sumBy = (rows: TransactionRow[], type: "income" | "expense") =>
    rows.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);

  const transactions = data ?? [];
  const prevTransactions = prevData ?? [];
  const income = sumBy(transactions, "income");
  const expense = sumBy(transactions, "expense");
  const recentGroups = groupByDate(transactions.slice(0, RECENT_LIMIT));

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">ダッシュボード</h1>
          <p className="text-sm font-medium text-muted-foreground tabular-nums">
            {formatPeriodLabel(range)}
          </p>
        </div>
        <ScopeToggle scope={scope} />
      </div>

      <SummaryCards
        income={income}
        expense={expense}
        prevIncome={sumBy(prevTransactions, "income")}
        prevExpense={sumBy(prevTransactions, "expense")}
      />

      <div className="flex items-center justify-between">
        <h2 className="font-heading text-base font-bold">最近の取引</h2>
        <Link
          href="/transactions"
          className={buttonVariants({ variant: "link", size: "sm" })}
        >
          すべて見る
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>

      {recentGroups.length === 0 ? (
        <Card className="shadow-soft ring-0">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <ReceiptText className="size-6" aria-hidden />
            </span>
            <p className="text-sm text-muted-foreground">
              この期間の収支はまだありません。
              <br />
              最初の一件を記録してみましょう。
            </p>
            <Link
              href="/transactions/new"
              className={buttonVariants({ size: "sm" })}
            >
              収支を記録
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {recentGroups.map((group) => (
            <section key={group.date} className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground tabular-nums">
                {formatDayLabel(group.date)}
              </h3>
              <ul className="space-y-2">
                {group.items.map((t) => (
                  <li key={t.id}>
                    <Card
                      data-testid="dashboard-transaction-row"
                      className="shadow-soft ring-0 transition-shadow hover:shadow-lifted"
                    >
                      <CardContent className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0 space-y-0.5">
                          <CategoryBadge category={t.category} />
                          {t.memo ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {t.memo}
                            </p>
                          ) : null}
                        </div>
                        <span
                          className={
                            t.type === "income"
                              ? "shrink-0 font-heading font-bold text-income tabular-nums"
                              : "shrink-0 font-heading font-bold text-expense tabular-nums"
                          }
                        >
                          {t.type === "income" ? "+" : "-"}
                          {yen(t.amount)}
                        </span>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
