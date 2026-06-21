import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type Tone = "income" | "expense" | "neutral";

type Props = {
  icon: LucideIcon;
  label?: string;
  tone?: Tone;
  className?: string;
};

const TONES: Record<Tone, string> = {
  income: "bg-income-soft text-income",
  expense: "bg-expense-soft text-expense",
  neutral: "bg-secondary text-secondary-foreground",
};

/** 丸い背景にアイコンを載せた小さなチップ。 */
export function IconChip({ icon: Icon, label, tone = "neutral", className }: Props) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full",
        TONES[tone],
        className,
      )}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      <Icon className="size-4" aria-hidden />
    </span>
  );
}
