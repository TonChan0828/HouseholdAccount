import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { TONE_CHIP, type Tone } from "./tone";

type Props = {
  icon: LucideIcon;
  label?: string;
  tone?: Tone;
  className?: string;
};

/** 丸い背景にアイコンを載せた小さなチップ。 */
export function IconChip({ icon: Icon, label, tone = "neutral", className }: Props) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full",
        TONE_CHIP[tone],
        className,
      )}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      <Icon className="size-4" aria-hidden />
    </span>
  );
}
