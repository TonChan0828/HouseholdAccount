import Link from "next/link";
import { CalendarDays, List } from "lucide-react";

import { cn } from "@/lib/utils";

type View = "list" | "calendar";

type Props = {
  active: View;
  className?: string;
};

const VIEWS: { key: View; href: string; label: string; icon: typeof List }[] = [
  { key: "list", href: "/transactions", label: "リスト", icon: List },
  { key: "calendar", href: "/calendar", label: "カレンダー", icon: CalendarDays },
];

/** 収支の「リスト ⇄ カレンダー」表示を切り替えるセグメントピル（presentational）。 */
export function ViewToggle({ active, className }: Props) {
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
        return (
          <Link
            key={view.key}
            href={view.href}
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
