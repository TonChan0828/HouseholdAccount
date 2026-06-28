"use client";

import { useState } from "react";
import Link from "next/link";

import { Amount } from "@/components/shared/amount";
import { Surface } from "@/components/shared/surface";
import { CategoryBadge } from "@/components/features/transactions/category-badge";
import { CardContent } from "@/components/ui/card";
import type { CalendarDay } from "@/lib/calendar";
import { formatDayLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export type CalendarTx = {
  id: string;
  amount: number;
  type: "income" | "expense";
  memo: string | null;
  category: { name: string; color: string | null } | null;
};

type Props = {
  weeks: CalendarDay[][];
  transactionsByDate: Record<string, CalendarTx[]>;
  initialSelected: string;
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

/** 暦月カレンダー。日セルに収支合計を表示し、選択日の明細を下部に出す。 */
export function CalendarBoard({
  weeks,
  transactionsByDate,
  initialSelected,
}: Props) {
  const [selected, setSelected] = useState(initialSelected);
  const today = new Date().toISOString().slice(0, 10);
  const items = transactionsByDate[selected] ?? [];

  return (
    <div className="space-y-4">
      <Surface variant="raised" className="overflow-hidden">
        <CardContent className="p-2 sm:p-3">
          {/* 曜日ヘッダー */}
          <div className="grid grid-cols-7">
            {WEEKDAYS.map((w, i) => (
              <span
                key={w}
                className={cn(
                  "py-1 text-center text-xs font-medium",
                  i === 0
                    ? "text-expense"
                    : i === 6
                      ? "text-income"
                      : "text-muted-foreground",
                )}
              >
                {w}
              </span>
            ))}
          </div>

          {/* 日セル */}
          <div className="grid grid-cols-7 gap-0.5">
            {weeks.flat().map((d) => {
              const dayNum = Number(d.date.slice(8, 10));
              const isSelected = d.date === selected;
              const isToday = d.date === today;
              return (
                <button
                  key={d.date}
                  type="button"
                  data-testid="calendar-day"
                  data-date={d.date}
                  data-in-month={d.inMonth}
                  aria-pressed={isSelected}
                  onClick={() => setSelected(d.date)}
                  className={cn(
                    "flex min-h-16 flex-col gap-0.5 rounded-md p-1 text-left transition-colors sm:min-h-20",
                    "hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    d.inMonth ? "bg-card" : "bg-transparent text-muted-foreground/50",
                    isSelected && "bg-secondary ring-2 ring-primary",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-5 items-center justify-center self-start rounded-full text-[11px] font-semibold tabular-nums",
                      isToday && "bg-primary text-primary-foreground",
                    )}
                  >
                    {dayNum}
                  </span>
                  <span className="flex flex-col items-end gap-0 leading-tight">
                    {d.income > 0 ? (
                      <Amount
                        value={d.income}
                        type="income"
                        className="text-[10px] font-medium sm:text-[11px]"
                      />
                    ) : null}
                    {d.expense > 0 ? (
                      <Amount
                        value={d.expense}
                        type="expense"
                        className="text-[10px] font-medium sm:text-[11px]"
                      />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Surface>

      {/* 選択日の明細 */}
      <section className="space-y-2">
        <h2 className="font-heading text-sm font-semibold">
          {formatDayLabel(selected)}
        </h2>
        {items.length === 0 ? (
          <Surface variant="raised">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              この日の収支はありません。
            </CardContent>
          </Surface>
        ) : (
          <ul className="space-y-2">
            {items.map((t) => (
              <li key={t.id}>
                <Link href={`/transactions/${t.id}/edit`} className="block">
                  <Surface
                    variant="raised"
                    className="overflow-hidden p-0 transition-shadow hover:shadow-lifted"
                  >
                    <CardContent className="flex items-stretch gap-0 p-0">
                      <span
                        aria-hidden
                        className={cn(
                          "w-1.5 shrink-0",
                          t.type === "income" ? "bg-income" : "bg-expense",
                        )}
                      />
                      <div className="flex flex-1 items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0 space-y-0.5">
                          <CategoryBadge category={t.category} />
                          {t.memo ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {t.memo}
                            </p>
                          ) : null}
                        </div>
                        <Amount value={t.amount} type={t.type} />
                      </div>
                    </CardContent>
                  </Surface>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
