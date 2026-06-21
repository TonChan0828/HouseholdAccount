"use client";

import { CardContent } from "@/components/ui/card";
import { yen } from "@/lib/format";
import { cn } from "@/lib/utils";

import { AnimatedNumber } from "./animated-number";
import { Surface } from "./surface";

type Kpi = {
  label: string;
  value: number;
  /**
   * 値の整形種別。"yen"=円整形(丸め) / "plain"=整数丸め(既定)。
   * Server→Client 境界を越えるため関数ではなく種別で指定する。
   */
  format?: "yen" | "plain";
  unit?: string;
};

type Props = {
  items: Kpi[];
  className?: string;
};

/** カウントアップ中の小数を避けるため丸めてから円整形する。 */
const yenRound = (n: number) => yen(Math.round(n));

/** 数値KPIをカード端いっぱいに並べ、セル間をヘアラインで仕切るリボン。 */
export function KpiRibbon({ items, className }: Props) {
  return (
    <Surface
      variant="raised"
      className={cn("relative overflow-hidden py-0", className)}
    >
      <CardContent className="grid grid-cols-2 gap-px bg-border/60 px-0 sm:grid-cols-4">
        {items.map((kpi) => (
          <div key={kpi.label} className="flex flex-col gap-1 bg-card p-4 sm:p-5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {kpi.label}
            </span>
            <span className="font-heading text-2xl font-bold tabular-nums">
              <AnimatedNumber
                value={kpi.value}
                format={kpi.format === "yen" ? yenRound : undefined}
              />
              {kpi.unit ? (
                <span className="ml-0.5 text-sm text-muted-foreground">
                  {kpi.unit}
                </span>
              ) : null}
            </span>
          </div>
        ))}
      </CardContent>
    </Surface>
  );
}
