import { PiggyBank, TrendingDown, TrendingUp } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { yen } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  income: number;
  expense: number;
  /** 前期の収入計。渡すと前期比を表示する。 */
  prevIncome?: number;
  /** 前期の支出計。渡すと前期比を表示する。 */
  prevExpense?: number;
};

function diffLabel(current: number, prev: number | undefined): string | null {
  if (prev === undefined) return null;
  const diff = current - prev;
  return `前期比 ${diff >= 0 ? "+" : ""}${yen(diff)}`;
}

/** 収入計・支出計・収支差を 3 枚のカードで表示する（presentational）。 */
export function SummaryCards({ income, expense, prevIncome, prevExpense }: Props) {
  const balance = income - expense;
  const cards = [
    {
      label: "収入",
      value: yen(income),
      icon: TrendingUp,
      tone: "text-income",
      iconBg: "bg-income-soft text-income",
      diff: diffLabel(income, prevIncome),
    },
    {
      label: "支出",
      value: yen(expense),
      icon: TrendingDown,
      tone: "text-expense",
      iconBg: "bg-expense-soft text-expense",
      diff: diffLabel(expense, prevExpense),
    },
    {
      label: "収支",
      value: yen(balance),
      icon: PiggyBank,
      tone: balance >= 0 ? "text-income" : "text-expense",
      iconBg:
        balance >= 0
          ? "bg-income-soft text-income"
          : "bg-expense-soft text-expense",
      diff:
        prevIncome !== undefined && prevExpense !== undefined
          ? diffLabel(balance, prevIncome - prevExpense)
          : null,
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-4" data-testid="summary-cards">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label} className="shadow-soft ring-0">
            <CardContent className="flex flex-col gap-1 max-sm:px-3">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full max-sm:hidden",
                    card.iconBg,
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  {card.label}
                </span>
              </div>
              <p
                className={cn(
                  "font-heading text-lg font-bold tabular-nums sm:text-2xl",
                  card.tone,
                )}
              >
                {card.value}
              </p>
              {card.diff ? (
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {card.diff}
                </p>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
