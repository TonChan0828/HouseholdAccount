"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";

import { Amount } from "@/components/shared/amount";
import { MainSideGrid } from "@/components/shared/main-side-grid";
import { Surface } from "@/components/shared/surface";
import { CategoryBadge } from "@/components/features/transactions/category-badge";
import { CardContent } from "@/components/ui/card";
import type { CalendarDay } from "@/lib/calendar";
import { compactAmount, formatDayLabel } from "@/lib/format";
import { localToday } from "@/lib/period";
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
  /** サイドレール上部に置く内容（当月サマリー等）。lg 未満ではグリッドの上に出る。 */
  side?: ReactNode;
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

const emptySubscribe = () => () => {};

/** SSR/ハイドレーション中は false、クライアント確定後に true。 */
function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

/**
 * 暦月カレンダー。日セルに収支合計を表示し、選択日の明細を出す。
 * lg 以上はメイン=グリッド / サイド=サマリー+明細の2カラム、
 * lg 未満はサマリー→グリッド→明細の縦積み（max-lg:order-*）。
 */
export function CalendarBoard({
  weeks,
  transactionsByDate,
  initialSelected,
  side,
}: Props) {
  // ユーザーが明示的に選択した日。未操作の間は「今日 or 初期値」を導出する。
  const [userSelected, setUserSelected] = useState<string | null>(null);
  // 「今日」はブラウザのローカル日付基準。サーバ描画時に確定するとローカルと
  // UTC の日境界ずれ（深夜〜早朝）でハイライト・初期選択が前日になるため、
  // ハイドレーション完了後にクライアントで確定する。
  const hydrated = useHydrated();
  const today = hydrated ? localToday() : null;
  const todayInMonth =
    today !== null &&
    weeks.some((w) => w.some((d) => d.inMonth && d.date === today));
  const selected = userSelected ?? (todayInMonth ? today : initialSelected);
  const items = transactionsByDate[selected] ?? [];

  const gridCard = (
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
                  onClick={() => setUserSelected(d.date)}
                  className={cn(
                    "flex min-h-14 min-w-0 flex-col gap-0.5 overflow-hidden rounded-md p-0.5 text-left transition-colors sm:min-h-20 sm:p-1",
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
                  <span className="flex w-full min-w-0 flex-col items-end gap-0 leading-tight">
                    {d.income > 0 ? (
                      <span className="w-full truncate text-right text-[9px] font-medium tabular-nums text-income sm:text-[11px]">
                        +{compactAmount(d.income)}
                      </span>
                    ) : null}
                    {d.expense > 0 ? (
                      <span className="w-full truncate text-right text-[9px] font-medium tabular-nums text-expense sm:text-[11px]">
                        -{compactAmount(d.expense)}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Surface>
  );

  const detail = (
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
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3">
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
  );

  return (
    <MainSideGrid
      main={<div className="max-lg:order-2">{gridCard}</div>}
      side={
        <>
          {side ? <div className="max-lg:order-1">{side}</div> : null}
          <div className="max-lg:order-3">{detail}</div>
        </>
      }
    />
  );
}
