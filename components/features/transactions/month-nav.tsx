import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

type Props = {
  label: string;
  prevHref: string;
  nextHref: string;
};

export function MonthNav({ label, prevHref, nextHref }: Props) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Link
        href={prevHref}
        aria-label="前の期間"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        ◀
      </Link>
      <span className="text-sm font-medium tabular-nums">{label}</span>
      <Link
        href={nextHref}
        aria-label="次の期間"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        ▶
      </Link>
    </div>
  );
}
