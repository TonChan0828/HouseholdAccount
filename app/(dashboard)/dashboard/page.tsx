import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Plus, ReceiptText } from "lucide-react";

import { BalanceBarChart } from "@/components/features/charts/balance-bar-chart.client";
import { CategoryMemberMatrix } from "@/components/features/dashboard/category-member-matrix";
import { ScopeToggle, type DashboardScope } from "@/components/features/dashboard/scope-toggle";
import { SummaryCards } from "@/components/features/dashboard/summary-cards";
import { CategoryBadge } from "@/components/features/transactions/category-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buildCategoryMemberMatrix } from "@/lib/category-matrix";
import { formatDayLabel, groupByDate, yen } from "@/lib/format";
import {
  getActiveHouseholdId,
  getCurrentUser,
  getHouseholdSettings,
} from "@/lib/household";
import type { MemberInfo } from "@/lib/members";
import {
  formatPeriodLabel,
  getPeriodRange,
  shiftPeriod,
  toISODate,
} from "@/lib/period";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type TransactionRow = {
  id: string;
  amount: number;
  type: "income" | "expense";
  date: string;
  memo: string | null;
  created_by: string;
  category_id: string | null;
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
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const householdId = await getActiveHouseholdId();
  if (!householdId) {
    redirect("/households");
  }

  const { periodStartDay: startDay } = await getHouseholdSettings(householdId);

  const range = getPeriodRange(new Date(), startDay);
  const prevRange = shiftPeriod(range, -1, startDay);

  // マトリクスが全メンバー分を必要とするため scope によらず無条件で取得し、
  // スコープ絞り込みは JS 側（byScope）で行う
  const buildQuery = (start: Date, end: Date) =>
    supabase
      .from("transactions")
      .select(
        "id, amount, type, date, memo, created_by, category_id, category:categories(name, color)",
      )
      .eq("household_id", householdId)
      .gte("date", toISODate(start))
      .lt("date", toISODate(end))
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

  const fetchMembers = async (): Promise<MemberInfo[]> => {
    const { data: memberRows } = await supabase
      .from("household_members")
      .select("user_id, joined_at")
      .eq("household_id", householdId)
      .order("joined_at");
    const userIds = (memberRows ?? []).map((m) => m.user_id);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds);
    const nameById = new Map(
      (profiles ?? []).map((p) => [p.id, p.display_name]),
    );

    return userIds.map((id) => ({
      user_id: id,
      display_name: nameById.get(id) ?? "不明なユーザー",
    }));
  };

  const [{ data }, { data: prevData }, members] = await Promise.all([
    buildQuery(range.start, range.end).overrideTypes<TransactionRow[]>(),
    buildQuery(prevRange.start, prevRange.end).overrideTypes<TransactionRow[]>(),
    fetchMembers(),
  ]);

  const sumBy = (rows: TransactionRow[], type: "income" | "expense") =>
    rows.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
  const byScope = (rows: TransactionRow[]) =>
    scope === "mine" ? rows.filter((t) => t.created_by === user.id) : rows;

  const transactions = data ?? [];
  const scopedTransactions = byScope(transactions);
  const prevTransactions = byScope(prevData ?? []);
  const income = sumBy(scopedTransactions, "income");
  const expense = sumBy(scopedTransactions, "expense");
  const recentGroups = groupByDate(scopedTransactions.slice(0, RECENT_LIMIT));
  const matrix = buildCategoryMemberMatrix(transactions, members);

  const reveal =
    "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 ease-out";

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:py-8">
      <div
        className={cn("flex flex-wrap items-end justify-between gap-3", reveal)}
      >
        <div className="space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            ホーム
          </p>
          <h1 className="text-2xl font-bold">ダッシュボード</h1>
          <p className="text-sm font-medium text-muted-foreground tabular-nums">
            {formatPeriodLabel(range)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ScopeToggle scope={scope} />
          <Link
            href="/transactions/new"
            className={buttonVariants({ size: "sm" })}
          >
            <Plus className="size-4" aria-hidden />
            記録する
          </Link>
        </div>
      </div>

      <div className={reveal} style={{ animationDelay: "60ms" }}>
        <SummaryCards
          income={income}
          expense={expense}
          prevIncome={sumBy(prevTransactions, "income")}
          prevExpense={sumBy(prevTransactions, "expense")}
        />
      </div>

      <Card
        className={cn("shadow-soft ring-0", reveal)}
        style={{ animationDelay: "120ms" }}
      >
        <CardHeader>
          <CardTitle className="text-base">当期の収支</CardTitle>
        </CardHeader>
        <CardContent>
          <BalanceBarChart income={income} expense={expense} />
        </CardContent>
      </Card>

      <div className={reveal} style={{ animationDelay: "180ms" }}>
        <CategoryMemberMatrix matrix={matrix} />
      </div>

      <div className={reveal} style={{ animationDelay: "240ms" }}>
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
          <Card className="mt-2 shadow-soft ring-0">
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
          <div className="mt-2 space-y-4">
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
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              aria-hidden
                              className={cn(
                                "h-9 w-1 shrink-0 rounded-full",
                                t.type === "income"
                                  ? "bg-income"
                                  : "bg-expense",
                              )}
                            />
                            <div className="min-w-0 space-y-0.5">
                              <CategoryBadge category={t.category} />
                              {t.memo ? (
                                <p className="truncate text-xs text-muted-foreground">
                                  {t.memo}
                                </p>
                              ) : null}
                            </div>
                          </div>
                          <span
                            className={cn(
                              "shrink-0 font-heading font-bold tabular-nums",
                              t.type === "income"
                                ? "text-income"
                                : "text-expense",
                            )}
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
      </div>
    </main>
  );
}
