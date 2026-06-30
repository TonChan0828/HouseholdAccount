import { TrendingUp, TriangleAlert } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { yen } from "@/lib/format";
import type { Forecast, ForecastBudget } from "@/lib/forecast";
import { cn } from "@/lib/utils";

type Props = {
  forecast: Forecast;
  budget: ForecastBudget | null;
};

/** 月末着地予測カード（当期表示時のみ描画）。世帯全体の着地を表示する。 */
export function ForecastCard({ forecast, budget }: Props) {
  const balancePositive = forecast.projectedBalance >= 0;

  return (
    <Card data-testid="forecast-card" className="shadow-soft">
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <TrendingUp className="size-4" aria-hidden />
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              月末着地予測
            </span>
          </div>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            残り{forecast.daysRemaining}日
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-0.5">
            <p className="text-[11px] text-muted-foreground">着地支出</p>
            <p className="font-heading text-lg font-bold tabular-nums text-expense">
              {yen(forecast.projectedExpense)}
            </p>
            <p className="text-[11px] tabular-nums text-muted-foreground">
              実績 {yen(forecast.actualExpense)}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[11px] text-muted-foreground">着地収支</p>
            <p
              className={cn(
                "font-heading text-lg font-bold tabular-nums",
                balancePositive ? "text-income" : "text-expense",
              )}
            >
              {yen(forecast.projectedBalance)}
            </p>
            <p className="text-[11px] tabular-nums text-muted-foreground">
              着地収入 {yen(forecast.projectedIncome)}
            </p>
          </div>
        </div>

        {budget?.willOverrun ? (
          <div
            data-testid="forecast-budget-warning"
            className="flex items-start gap-2 rounded-xl bg-expense-soft px-3 py-2 text-expense"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="text-[11px] leading-relaxed">
              このペースだと予算を{" "}
              <span className="font-bold tabular-nums">{yen(budget.overBy)}</span>{" "}
              超過して着地します（予算 {yen(budget.totalBudget)} / 着地{" "}
              {yen(budget.projectedSpent)}）
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
