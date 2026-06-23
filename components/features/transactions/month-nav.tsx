import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  label: string;
  prevHref: string;
  nextHref: string;
  /** 追加クラス（モバイルで全幅にする等の調整用）。 */
  className?: string;
};

/** 期間を前後に切り替えるセグメントピル。中央にラベルを置く（presentational）。 */
export function MonthNav({ label, prevHref, nextHref, className }: Props) {
  return (
    <div
      className={cn(
        "flex w-full items-center gap-1 rounded-full border bg-card/70 p-1 shadow-soft ring-1 ring-foreground/5 backdrop-blur sm:inline-flex sm:w-auto",
        className,
      )}
    >
      <Link
        href={prevHref}
        aria-label="前の期間"
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
      </Link>
      <span className="min-w-0 flex-1 text-center font-heading text-sm font-semibold tabular-nums sm:min-w-44 sm:flex-none">
        {label}
      </span>
      <Link
        href={nextHref}
        aria-label="次の期間"
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}
