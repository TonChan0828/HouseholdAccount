import Link from "next/link";
import { CalendarRange, CalendarDays } from "lucide-react";

import { cn } from "@/lib/utils";

type View = "month" | "year";

type Props = {
  active: View;
  className?: string;
};

const VIEWS: {
  key: View;
  href: string;
  label: string;
  icon: typeof CalendarDays;
}[] = [
  { key: "month", href: "/analytics", label: "月次", icon: CalendarDays },
  { key: "year", href: "/analytics?view=year", label: "年間", icon: CalendarRange },
];

/** 分析の「月次 ⇄ 年間」表示を切り替えるセグメントピル（presentational）。 */
export function AnalyticsViewTabs({ active, className }: Props) {
  return (
    <nav
      aria-label="分析の表示切替"
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
    </nav>
  );
}
