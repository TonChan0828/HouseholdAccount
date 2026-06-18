import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, Plus, ReceiptText } from "lucide-react";

import { deleteTransaction } from "@/app/(dashboard)/transactions/actions";
import { SummaryCards } from "@/components/features/dashboard/summary-cards";
import { CategoryBadge } from "@/components/features/transactions/category-badge";
import { MonthNav } from "@/components/features/transactions/month-nav";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDayLabel, groupByDate, yen } from "@/lib/format";
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

type TransactionRow = {
  id: string;
  amount: number;
  type: "income" | "expense";
  date: string;
  memo: string | null;
  created_by: string;
  category: { name: string; color: string | null } | null;
};

function refFromParam(ref: string | undefined): Date {
  if (ref && /^\d{4}-\d{2}-\d{2}$/.test(ref)) {
    return new Date(`${ref}T00:00:00Z`);
  }
  return new Date();
}

export default async function TransactionsPage({
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

  const range = getPeriodRange(refFromParam(ref), startDay);
  const isoStart = toISODate(range.start);
  const isoEnd = toISODate(range.end);

  const { data } = await supabase
    .from("transactions")
    .select("id, amount, type, date, memo, created_by, category:categories(name, color)")
    .eq("household_id", householdId)
    .gte("date", isoStart)
    .lt("date", isoEnd)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .overrideTypes<TransactionRow[]>();

  const transactions = data ?? [];
  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const expense = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const groups = groupByDate(transactions);

  const prevHref = `/transactions?ref=${toISODate(shiftPeriod(range, -1, startDay).start)}`;
  const nextHref = `/transactions?ref=${toISODate(shiftPeriod(range, 1, startDay).start)}`;

  return (
    <main className="mx-auto w-full max-w-4xl animate-in space-y-5 p-4 duration-500 fade-in slide-in-from-bottom-2 sm:py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">収支</h1>
        <div className="flex items-center gap-2">
          {/* Route Handler（CSV）へは素の <a> を使う。<Link> だと RSC を
              プリフェッチしようとして "unexpected response" エラーになる。 */}
          <a
            href={`/transactions/export?ref=${toISODate(range.start)}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Download className="size-4" aria-hidden />
            CSV出力
          </a>
          <Link
            href="/transactions/new"
            className={buttonVariants({ variant: "default", size: "sm" })}
          >
            <Plus className="size-4" aria-hidden />
            収支を追加
          </Link>
        </div>
      </div>

      <MonthNav
        label={formatPeriodLabel(range)}
        prevHref={prevHref}
        nextHref={nextHref}
      />

      <SummaryCards income={income} expense={expense} />

      {groups.length === 0 ? (
        <Card className="shadow-soft ring-0">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <ReceiptText className="size-6" aria-hidden />
            </span>
            <p className="text-sm text-muted-foreground">
              この期間の収支はまだありません。
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
          {groups.map((group) => (
            <section key={group.date} className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground tabular-nums">
                {formatDayLabel(group.date)}
              </h3>
              <ul className="space-y-2">
                {group.items.map((t) => {
                  const mine = t.created_by === user.id;
                  return (
                    <li key={t.id}>
                      <Card
                        data-testid="transaction-row"
                        className="shadow-soft ring-0 transition-shadow hover:shadow-lifted"
                      >
                        <CardContent className="flex items-center justify-between gap-3 py-3">
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <CategoryBadge category={t.category} />
                              {!mine ? (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                  他のメンバー
                                </span>
                              ) : null}
                            </div>
                            {t.memo ? (
                              <p className="truncate text-xs text-muted-foreground">
                                {t.memo}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span
                              className={
                                t.type === "income"
                                  ? "font-heading font-bold text-income tabular-nums"
                                  : "font-heading font-bold text-expense tabular-nums"
                              }
                            >
                              {t.type === "income" ? "+" : "-"}
                              {yen(t.amount)}
                            </span>
                            {mine ? (
                              <>
                                <Link
                                  href={`/transactions/${t.id}/edit`}
                                  className={buttonVariants({
                                    variant: "ghost",
                                    size: "sm",
                                  })}
                                >
                                  編集
                                </Link>
                                <form action={deleteTransaction}>
                                  <input type="hidden" name="id" value={t.id} />
                                  <Button
                                    type="submit"
                                    variant="ghost"
                                    size="sm"
                                    aria-label="削除"
                                    className="text-destructive hover:text-destructive"
                                  >
                                    削除
                                  </Button>
                                </form>
                              </>
                            ) : null}
                          </div>
                        </CardContent>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
