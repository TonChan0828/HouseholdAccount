import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  label: string;
  prevHref: string;
  nextHref: string;
};

/** 期間を前後に切り替えるセグメントピル。中央にラベルを置く（presentational）。 */
export function MonthNav({ label, prevHref, nextHref }: Props) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border bg-card/70 p-1 shadow-soft ring-1 ring-foreground/5 backdrop-blur">
      <Link
        href={prevHref}
        aria-label="前の期間"
        className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
      </Link>
      <span className="min-w-44 text-center font-heading text-sm font-semibold tabular-nums">
        {label}
      </span>
      <Link
        href={nextHref}
        aria-label="次の期間"
        className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}
