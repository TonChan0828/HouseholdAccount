import Link from "next/link";
import { redirect } from "next/navigation";

import { deleteTransaction } from "@/app/(dashboard)/transactions/actions";
import { MonthNav } from "@/components/features/transactions/month-nav";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

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

  const prevHref = `/transactions?ref=${toISODate(shiftPeriod(range, -1, startDay).start)}`;
  const nextHref = `/transactions?ref=${toISODate(shiftPeriod(range, 1, startDay).start)}`;

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 p-4 sm:py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">収支</h1>
        <Link
          href="/transactions/new"
          className={buttonVariants({ variant: "default", size: "sm" })}
        >
          収支を追加
        </Link>
      </div>

      <MonthNav
        label={formatPeriodLabel(range)}
        prevHref={prevHref}
        nextHref={nextHref}
      />

      <Card>
        <CardContent className="grid grid-cols-3 gap-2 py-4 text-center">
          <div>
            <p className="text-xs text-muted-foreground">収入</p>
            <p className="font-semibold text-emerald-600">{yen(income)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">支出</p>
            <p className="font-semibold text-red-600">{yen(expense)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">収支</p>
            <p className="font-semibold tabular-nums">{yen(income - expense)}</p>
          </div>
        </CardContent>
      </Card>

      {transactions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            この期間の収支はまだありません。
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {transactions.map((t) => {
            const mine = t.created_by === user.id;
            return (
              <li key={t.id}>
                <Card data-testid="transaction-row">
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
                              style={{
                                backgroundColor: t.category.color ?? "#999",
                              }}
                            />
                            {t.category.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">未分類</span>
                        )}
                        {!mine ? (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
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
                            ? "font-semibold text-emerald-600 tabular-nums"
                            : "font-semibold text-red-600 tabular-nums"
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
      )}

      <div className="text-center">
        <Link href="/" className={buttonVariants({ variant: "link" })}>
          ダッシュボードへ
        </Link>
      </div>
    </main>
  );
}
