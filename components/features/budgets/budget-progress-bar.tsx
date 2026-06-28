import { yen } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  spent: number;
  budget: number;
  className?: string;
};

/**
 * 予算に対する実績支出の進捗バー（presentational）。
 * 予算を 100% のトラックとし、実績で左から充填する。超過時は全面を支出色にする。
 */
export function BudgetProgressBar({ spent, budget, className }: Props) {
  const over = budget > 0 && spent > budget;
  const pct =
    budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
  const rawPct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
  const remaining = budget - spent;

  const note =
    budget <= 0
      ? "予算未設定"
      : over
        ? `予算超過 +${yen(spent - budget)}`
        : `残り ${yen(remaining)}`;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
        <span>
          {yen(spent)} <span className="opacity-60">/ {yen(budget)}</span>
        </span>
        {budget > 0 && (
          <span className={cn("font-medium", over && "text-expense")}>
            {rawPct}%
          </span>
        )}
      </div>
      <div
        role="img"
        aria-label={
          budget > 0
            ? `予算 ${yen(budget)} に対し実績 ${yen(spent)}（${rawPct}%）。${note}`
            : note
        }
        className="h-2 w-full overflow-hidden rounded-full bg-secondary"
      >
        <div
          className={cn(
            "h-full transition-[width] duration-700 ease-out",
            over ? "bg-expense" : "bg-income",
          )}
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </div>
      <p
        className={cn(
          "text-[11px] tabular-nums",
          over ? "font-medium text-expense" : "text-muted-foreground",
        )}
      >
        {note}
      </p>
    </div>
  );
}
