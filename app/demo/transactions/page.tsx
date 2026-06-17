"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, ReceiptText } from "lucide-react";

import { useDemo } from "@/components/features/demo/demo-provider";
import { SummaryCards } from "@/components/features/dashboard/summary-cards";
import { CategoryBadge } from "@/components/features/transactions/category-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { DemoTransactionRow } from "@/lib/demo/store";
import { formatDayLabel, groupByDate, yen } from "@/lib/format";
import {
  formatPeriodLabel,
  getPeriodRange,
  shiftPeriod,
  toISODate,
} from "@/lib/period";

export default function DemoTransactionsPage() {
  const { household, currentUserId, rows, deleteTransactionAction } = useDemo();
  // 期間の基準日を local state で持つ（URL を使わずに前後の期間へ移動する）。
  const [refDate, setRefDate] = useState(() => new Date());

  const startDay = household.period_start_day;
  const range = getPeriodRange(refDate, startDay);
  const isoStart = toISODate(range.start);
  const isoEnd = toISODate(range.end);

  const transactions: DemoTransactionRow[] = rows
    .filter((r) => r.date >= isoStart && r.date < isoEnd)
    .sort((a, b) => b.date.localeCompare(a.date));

  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const expense = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const groups = groupByDate(transactions);

  const shift = (delta: number) =>
    setRefDate(shiftPeriod(range, delta, startDay).start);

  return (
    <main className="mx-auto w-full max-w-4xl animate-in space-y-5 p-4 duration-500 fade-in slide-in-from-bottom-2 sm:py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">収支</h1>
        <Link
          href="/demo/transactions/new"
          className={buttonVariants({ variant: "default", size: "sm" })}
        >
          <Plus className="size-4" aria-hidden />
          収支を追加
        </Link>
      </div>

      <div className="flex items-center justify-between rounded-xl border bg-card px-2 py-1.5 shadow-soft">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="前の期間"
          onClick={() => shift(-1)}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <span className="text-sm font-medium tabular-nums">
          {formatPeriodLabel(range)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="次の期間"
          onClick={() => shift(1)}
        >
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>

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
              href="/demo/transactions/new"
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
                  const mine = t.created_by === currentUserId;
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
                                  href={`/demo/transactions/${t.id}/edit`}
                                  className={buttonVariants({
                                    variant: "ghost",
                                    size: "sm",
                                  })}
                                >
                                  編集
                                </Link>
                                <form action={deleteTransactionAction}>
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
