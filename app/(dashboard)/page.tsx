import Link from "next/link";
import { redirect } from "next/navigation";

import { ScopeToggle, type DashboardScope } from "@/components/features/dashboard/scope-toggle";
import { SummaryCards } from "@/components/features/dashboard/summary-cards";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getActiveHouseholdId } from "@/lib/household";
import { formatPeriodLabel, getPeriodRange, toISODate } from "@/lib/period";
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

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

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
  const isoStart = toISODate(range.start);
  const isoEnd = toISODate(range.end);

  let query = supabase
    .from("transactions")
    .select("id, amount, type, date, memo, created_by, category:categories(name, color)")
    .eq("household_id", householdId)
    .gte("date", isoStart)
    .lt("date", isoEnd)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (scope === "mine") {
    query = query.eq("created_by", user.id);
  }
  const { data } = await query.overrideTypes<TransactionRow[]>();

  const transactions = data ?? [];
  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const expense = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const recent = transactions.slice(0, RECENT_LIMIT);

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 p-4 sm:py-8">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">ダッシュボード</h1>
        <div className="flex gap-2">
          <Link
            href="/transactions/new"
            className={buttonVariants({ variant: "default", size: "sm" })}
          >
            収支を記録
          </Link>
          <Link
            href="/households"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            グループ選択
          </Link>
        </div>
      </div>

      <p className="text-sm font-medium text-muted-foreground tabular-nums">
        {formatPeriodLabel(range)}
      </p>

      <ScopeToggle scope={scope} />

      <SummaryCards income={income} expense={expense} />

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">最近の取引</h2>
        <Link href="/transactions" className={buttonVariants({ variant: "link", size: "sm" })}>
          すべて見る →
        </Link>
      </div>

      {recent.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            この期間の収支はまだありません。
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {recent.map((t) => (
            <li key={t.id}>
              <Card data-testid="dashboard-transaction-row">
                <CardContent className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground tabular-nums">
                        {t.date}
                      </span>
                      {t.category ? (
                        <span className="inline-flex items-center gap-1">
                          <span
                            className="inline-block size-2 rounded-full"
                            style={{ backgroundColor: t.category.color ?? "#999" }}
                          />
                          {t.category.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">未分類</span>
                      )}
                    </div>
                    {t.memo ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {t.memo}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={
                      t.type === "income"
                        ? "shrink-0 font-semibold text-emerald-600 tabular-nums"
                        : "shrink-0 font-semibold text-red-600 tabular-nums"
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
      )}
    </main>
  );
}
