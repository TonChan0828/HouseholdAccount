import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { AnimatedNumber } from "./animated-number";
import { IconChip } from "./icon-chip";
import { TONE_TEXT, type Tone } from "./tone";

type Props = {
  label: string;
  value: number;
  format?: (n: number) => string;
  icon?: LucideIcon;
  tone?: Tone;
  className?: string;
};

/** アイコンチップ + ラベル + カウントアップ値のタイル。 */
export function StatTile({
  label,
  value,
  format,
  icon,
  tone = "neutral",
  className,
}: Props) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-2">
        {icon ? <IconChip icon={icon} tone={tone} /> : null}
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <AnimatedNumber
        value={value}
        format={format}
        className={cn(
          "font-heading text-xl font-bold tabular-nums",
          TONE_TEXT[tone],
        )}
      />
    </div>
  );
}
