import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Plus, ReceiptText } from "lucide-react";

import { BalanceBarChart } from "@/components/features/charts/balance-bar-chart.client";
import { CategoryMemberMatrix } from "@/components/features/dashboard/category-member-matrix";
import { ScopeToggle, type DashboardScope } from "@/components/features/dashboard/scope-toggle";
import { SavingsGoalCard } from "@/components/features/dashboard/savings-goal-card";
import { SummaryCards } from "@/components/features/dashboard/summary-cards";
import { CategoryBadge } from "@/components/features/transactions/category-badge";
import { MonthNav } from "@/components/features/transactions/month-nav";
import { buttonVariants } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Amount } from "@/components/shared/amount";
import { PageHeader } from "@/components/shared/page-header";
import { SectionHeading } from "@/components/shared/section-heading";
import { Surface } from "@/components/shared/surface";
import { buildCategoryMemberMatrix } from "@/lib/category-matrix";
import { formatDayLabel, groupByDate } from "@/lib/format";
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
import { buildSavingsProgress, type SavingsProgress } from "@/lib/savings-goal";
import { ensureRecurringGenerated } from "@/lib/recurring";
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

function refFromParam(ref: string | undefined): Date {
  if (ref && /^\d{4}-\d{2}-\d{2}$/.test(ref)) {
    return new Date(`${ref}T00:00:00Z`);
  }
  return new Date();
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; ref?: string }>;
}) {
  const { scope: scopeParam, ref } = await searchParams;
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

  // 当期分の定期収支を（未生成なら）生成してから取得する。冪等。
  await ensureRecurringGenerated(householdId);

  const { periodStartDay: startDay } = await getHouseholdSettings(householdId);

  const range = getPeriodRange(refFromParam(ref), startDay);
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
      .select("user_id, joined_at, display_name")
      .eq("household_id", householdId)
      .order("joined_at");
    const memberList = memberRows ?? [];
    const userIds = memberList.map((m) => m.user_id);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds);
    const nameById = new Map(
      (profiles ?? []).map((p) => [p.id, p.display_name]),
    );

    // グループ毎の名前（household_members.display_name）優先・未設定はグローバル名へ。
    return memberList.map((m) => ({
      user_id: m.user_id,
      display_name:
        m.display_name ?? nameById.get(m.user_id) ?? "不明なユーザー",
    }));
  };

  const fetchBudgets = async () => {
    const { data: budgetRows } = await supabase
      .from("budgets")
      .select("category_id, amount")
      .eq("household_id", householdId);
    return budgetRows ?? [];
  };

  // 貯金目標（グループに1件）と、開始日以降の世帯全体の収支差額を取得する。
  // 上限（今日まで）は付けない。サーバの UTC 基準の「今日」とユーザーのローカル
  // 日付がずれると当日の収支が除外されてしまうため（貯金額＝開始日以降の収支差額）。
  const fetchSavingsGoal = async (): Promise<{
    progress: SavingsProgress | null;
    goal: { start_date: string; target_date: string | null } | null;
  }> => {
    const { data: goal } = await supabase
      .from("savings_goals")
      .select("name, target_amount, start_date, target_date")
      .eq("household_id", householdId)
      .maybeSingle();
    if (!goal) return { progress: null, goal: null };

    const { data: savedRows } = await supabase
      .from("transactions")
      .select("amount, type")
      .eq("household_id", householdId)
      .gte("date", goal.start_date);
    const saved = (savedRows ?? []).reduce(
      (s, t) => s + (t.type === "income" ? t.amount : -t.amount),
      0,
    );

    return {
      progress: buildSavingsProgress(
        {
          name: goal.name,
          targetAmount: goal.target_amount,
          startDate: goal.start_date,
          targetDate: goal.target_date,
        },
        saved,
        new Date(),
      ),
      goal: { start_date: goal.start_date, target_date: goal.target_date },
    };
  };

  const [{ data }, { data: prevData }, members, budgets, savingsGoal] =
    await Promise.all([
      buildQuery(range.start, range.end).overrideTypes<TransactionRow[]>(),
      buildQuery(prevRange.start, prevRange.end).overrideTypes<TransactionRow[]>(),
      fetchMembers(),
      fetchBudgets(),
      fetchSavingsGoal(),
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

  // 予算進捗（世帯全体）。scope に関わらず全メンバーの当期支出と対比する。
  // 実績は予算設定済みカテゴリ分のみを合算する。
  const spentByCategory = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "expense" || !t.category_id) continue;
    spentByCategory.set(
      t.category_id,
      (spentByCategory.get(t.category_id) ?? 0) + t.amount,
    );
  }
  const budgetTotal = budgets.reduce((s, b) => s + b.amount, 0);
  const budgetSpent = budgets.reduce(
    (s, b) => s + (spentByCategory.get(b.category_id) ?? 0),
    0,
  );

  // 月送りリンク。scope を引き継ぎつつ ref で期間を移動する。
  const buildHref = (refDate: Date) =>
    `/dashboard?ref=${toISODate(refDate)}${scope === "mine" ? "&scope=mine" : ""}`;
  const prevHref = buildHref(shiftPeriod(range, -1, startDay).start);
  const nextHref = buildHref(shiftPeriod(range, 1, startDay).start);

  // 「記録する」は表示中の期間を引き継ぐ。当期を見ているときは日付を渡さず、
  // フォーム側の既定（今日）に委ねて従来どおりの挙動にする。
  const currentRange = getPeriodRange(new Date(), startDay);
  const viewingCurrent =
    toISODate(range.start) === toISODate(currentRange.start);
  const newTransactionHref = viewingCurrent
    ? "/transactions/new"
    : `/transactions/new?date=${toISODate(range.start)}`;
  // 「すべて見る」も表示中の期間を引き継ぐ（/transactions は ?ref= で期間を保持）。
  const allTransactionsHref = viewingCurrent
    ? "/transactions"
    : `/transactions?ref=${toISODate(range.start)}`;

  const reveal =
    "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 ease-out";

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:py-8">
      <PageHeader
        eyebrow="ホーム"
        title="ダッシュボード"
        className={reveal}
        actions={
          <>
            <MonthNav
              label={formatPeriodLabel(range)}
              prevHref={prevHref}
              nextHref={nextHref}
            />
            <ScopeToggle
              scope={scope}
              currentRef={ref}
              className="w-full justify-center sm:w-auto"
            />
            <Link
              href={newTransactionHref}
              className={cn(
                buttonVariants({ size: "sm" }),
                "hidden sm:inline-flex",
              )}
            >
              <Plus className="size-4" aria-hidden />
              記録する
            </Link>
          </>
        }
      />

      <div className={reveal} style={{ animationDelay: "60ms" }}>
        <SummaryCards
          income={income}
          expense={expense}
          prevIncome={sumBy(prevTransactions, "income")}
          prevExpense={sumBy(prevTransactions, "expense")}
          budgetTotal={budgetTotal}
          budgetSpent={budgetSpent}
        />
      </div>

      <div className={reveal} style={{ animationDelay: "90ms" }}>
        <SavingsGoalCard
          progress={savingsGoal.progress}
          goal={savingsGoal.goal}
        />
      </div>

      <div className={reveal} style={{ animationDelay: "120ms" }}>
        <SectionHeading>当期の収支</SectionHeading>
        <Surface variant="raised">
          <CardContent>
            <BalanceBarChart income={income} expense={expense} />
          </CardContent>
        </Surface>
      </div>

      <div className={reveal} style={{ animationDelay: "180ms" }}>
        <CategoryMemberMatrix matrix={matrix} />
      </div>

      <div className={reveal} style={{ animationDelay: "240ms" }}>
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-base font-bold">最近の取引</h2>
          <Link
            href={allTransactionsHref}
            className={buttonVariants({ variant: "link", size: "sm" })}
          >
            すべて見る
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>

        {recentGroups.length === 0 ? (
          <Surface variant="raised" className="mt-2">
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
                href={newTransactionHref}
                className={buttonVariants({ size: "sm" })}
              >
                収支を記録
              </Link>
            </CardContent>
          </Surface>
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
                      <Surface
                        variant="raised"
                        data-testid="dashboard-transaction-row"
                        className="transition-shadow hover:shadow-lifted"
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
                          <Amount
                            value={t.amount}
                            type={t.type}
                            className="shrink-0"
                          />
                        </CardContent>
                      </Surface>
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
