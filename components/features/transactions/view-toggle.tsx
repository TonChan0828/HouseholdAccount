import Link from "next/link";
import { CalendarDays, List } from "lucide-react";

import { buildFilterQueryString, type TransactionFilter } from "@/lib/transaction-filter";
import { cn } from "@/lib/utils";

type View = "list" | "calendar";

type Props = {
  active: View;
  /** 現在表示している期間に属する日付。切替先でもこの期間を解決する。 */
  currentRef?: string;
  filter?: TransactionFilter;
  className?: string;
};

const VIEWS: { key: View; path: string; label: string; icon: typeof List }[] = [
  { key: "list", path: "/transactions", label: "リスト", icon: List },
  { key: "calendar", path: "/calendar", label: "カレンダー", icon: CalendarDays },
];

/** 収支の「リスト ⇄ カレンダー」表示を切り替えるセグメントピル（presentational）。 */
export function ViewToggle({ active, currentRef, filter = {}, className }: Props) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border bg-card/70 p-1 shadow-soft ring-1 ring-foreground/5 backdrop-blur",
        className,
      )}
    >
      {VIEWS.map((view) => {
        const isActive = view.key === active;
        const Icon = view.icon;
        const params = new URLSearchParams(buildFilterQueryString(filter));
        if (currentRef) params.set("ref", currentRef);
        const query = params.toString();
        const href = `${view.path}${query ? `?${query}` : ""}`;
        return (
          <Link
            key={view.key}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors",
              isActive
                ? "bg-secondary text-secondary-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {view.label}
          </Link>
        );
      })}
    </div>
  );
}
