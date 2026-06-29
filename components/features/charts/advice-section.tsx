import { CheckCircle2, Info, TrendingUp, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { Advice, AdviceSeverity } from "@/lib/advice";
import { cn } from "@/lib/utils";

type Props = {
  advice: Advice[];
};

/** severity ごとのアイコンとチップ配色。 */
const STYLE: Record<AdviceSeverity, { icon: LucideIcon; chip: string }> = {
  alert: { icon: TriangleAlert, chip: "bg-expense-soft text-expense" },
  warn: {
    icon: TrendingUp,
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  },
  good: { icon: CheckCircle2, chip: "bg-income-soft text-income" },
  info: { icon: Info, chip: "bg-secondary text-secondary-foreground" },
};

/**
 * ルールベースの家計アドバイスをカード列で表示する（presentational / server component）。
 * 並びと件数の制御は lib/advice.ts#buildAdvice 側で済んでいる前提。
 */
export function AdviceSection({ advice }: Props) {
  if (advice.length === 0) return null;

  return (
    <ul className="space-y-3">
      {advice.map((a, i) => {
        const { icon: Icon, chip } = STYLE[a.severity];
        return (
          <li
            key={a.id}
            className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500 ease-out"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <span
              className={cn(
                "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                chip,
              )}
              aria-hidden
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug">{a.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{a.detail}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
