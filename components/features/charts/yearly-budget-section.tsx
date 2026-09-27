import { CardContent } from "@/components/ui/card";
import { BudgetProgressBar } from "@/components/features/budgets/budget-progress-bar";
import { SectionHeading } from "@/components/shared/section-heading";
import { Surface } from "@/components/shared/surface";
import type { YearlyBudgetSummary } from "@/lib/yearly-budget";
import { yen } from "@/lib/format";

/** 年間予算額の供給元を決めつけない、年間予実の表示コンポーネント。 */
export function YearlyBudgetSection({
  summary,
}: {
  summary: YearlyBudgetSummary;
}) {
  const hasBudget = summary.totalBudget > 0;

  return (
    <section aria-label="年間予算と実績">
      <SectionHeading>年間予算と実績</SectionHeading>
      <Surface variant="raised">
        <CardContent className="space-y-5 py-5">
          {hasBudget ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">予算設定カテゴリの合計</span>
                <span className="font-heading font-bold tabular-nums">
                  {yen(summary.totalActual)} / {yen(summary.totalBudget)}
                </span>
              </div>
              <BudgetProgressBar
                spent={summary.totalActual}
                budget={summary.totalBudget}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              年間予算が設定されていません。
            </p>
          )}

          {summary.rows.length > 0 ? (
            <ul className="divide-y divide-border" aria-label="カテゴリ別年間予実">
              {summary.rows.map((row) => (
                <li
                  key={row.categoryId}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: row.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {row.annualBudget > 0
                        ? `${yen(row.actual)} / ${yen(row.annualBudget)}`
                        : `実績 ${yen(row.actual)}・年間予算未設定`}
                    </p>
                  </div>
                  {row.annualBudget > 0 ? (
                    <span
                      className={`shrink-0 text-sm font-medium tabular-nums ${
                        row.over ? "text-expense" : "text-muted-foreground"
                      }`}
                    >
                      {row.pct}%
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      未設定
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Surface>
    </section>
  );
}
