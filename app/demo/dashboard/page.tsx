"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ReceiptText, User, Users } from "lucide-react";

import { useDemo } from "@/components/features/demo/demo-provider";
import { BalanceBarChart } from "@/components/features/charts/balance-bar-chart";
import { CategoryMemberMatrix } from "@/components/features/dashboard/category-member-matrix";
import { MainSideGrid } from "@/components/shared/main-side-grid";
import { SummaryCards } from "@/components/features/dashboard/summary-cards";
import { CategoryBadge } from "@/components/features/transactions/category-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DemoTransactionRow } from "@/lib/demo/store";
import { buildCategoryMemberMatrix } from "@/lib/category-matrix";
import { formatDayLabel, groupByDate, yen } from "@/lib/format";
import {
  formatPeriodLabel,
  getPeriodRange,
  shiftPeriod,
  toISODate,
} from "@/lib/period";
import { cn } from "@/lib/utils";

const RECENT_LIMIT = 5;

type Scope = "all" | "mine";

const inRange = (rows: DemoTransactionRow[], start: string, end: string) =>
  rows
    .filter((r) => r.date >= start && r.date < end)
    .sort((a, b) => b.date.localeCompare(a.date));

const sumBy = (rows: DemoTransactionRow[], type: "income" | "expense") =>
  rows.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);

export default function DemoDashboardPage() {
  const { household, currentUserId, members, rows } = useDemo();
  const [scope, setScope] = useState<Scope>("all");

  const startDay = household.period_start_day;
  const range = getPeriodRange(new Date(), startDay);
  const prevRange = shiftPeriod(range, -1, startDay);

  const periodRows = inRange(rows, toISODate(range.start), toISODate(range.end));
  const prevPeriodRows = inRange(
    rows,
    toISODate(prevRange.start),
    toISODate(prevRange.end),
  );

  const byScope = (list: DemoTransactionRow[]) =>
    scope === "mine"
      ? list.filter((t) => t.created_by === currentUserId)
      : list;

  const scoped = byScope(periodRows);
  const prevScoped = byScope(prevPeriodRows);
  const income = sumBy(scoped, "income");
  const expense = sumBy(scoped, "expense");
  const recentGroups = groupByDate(scoped.slice(0, RECENT_LIMIT));
  // マトリクスは全メンバー分が必要なため scope によらず当期全件で集計する。
  const matrix = buildCategoryMemberMatrix(periodRows, members);

  return (
    <main className="mx-auto w-full max-w-4xl animate-in space-y-5 p-4 duration-500 fade-in slide-in-from-bottom-2 sm:py-8 lg:max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">ダッシュボード</h1>
          <p className="text-sm font-medium text-muted-foreground tabular-nums">
            {formatPeriodLabel(range)}
          </p>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full border bg-card/70 p-1 shadow-soft ring-1 ring-foreground/5 backdrop-blur">
          {(["all", "mine"] as const).map((value) => {
            const active = value === scope;
            const Icon = value === "all" ? Users : User;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setScope(value)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors",
                  active
                    ? "bg-secondary text-secondary-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {value === "all" ? "全体" : "自分"}
              </button>
            );
          })}
        </div>
      </div>

      {/*
        デスクトップ（lg 以上）は本番ダッシュボードと同じメイン7:サイド5の
        2カラム。モバイルは DOM 順のまま従来の縦積み（ヒーロー→チャート→
        マトリクス→最近の取引）になる。
      */}
      <MainSideGrid
        main={
          <>
            <SummaryCards
              income={income}
              expense={expense}
              prevIncome={sumBy(prevScoped, "income")}
              prevExpense={sumBy(prevScoped, "expense")}
            />

            <Card className="shadow-soft ring-0">
              <CardHeader>
                <CardTitle className="text-base">当期の収支</CardTitle>
              </CardHeader>
              <CardContent>
                <BalanceBarChart income={income} expense={expense} />
              </CardContent>
            </Card>

            <CategoryMemberMatrix matrix={matrix} />
          </>
        }
        side={
          <div>
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-base font-bold">最近の取引</h2>
              <Link
                href="/demo/transactions"
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
                    href="/demo/transactions/new"
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
                          <Card className="shadow-soft ring-0 transition-shadow hover:shadow-lifted">
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
          </div>
        }
      />
    </main>
  );
}
