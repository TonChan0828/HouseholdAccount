import Link from "next/link";

import { cn } from "@/lib/utils";

export type DashboardScope = "all" | "mine";

type Props = {
  scope: DashboardScope;
  /** 表示中の期間（ref クエリ）。指定時はリンクに引き継いで月を維持する。 */
  currentRef?: string;
};

const items: { value: DashboardScope; label: string }[] = [
  { value: "all", label: "全体" },
  { value: "mine", label: "自分" },
];

/** 全体/自分の絞り込みリンク。現在値を強調する（presentational）。 */
export function ScopeToggle({ scope, currentRef }: Props) {
  return (
    <div className="inline-flex rounded-md border p-0.5">
      {items.map((item) => {
        const active = item.value === scope;
        return (
          <Link
            key={item.value}
            href={`/dashboard?scope=${item.value}${
              currentRef ? `&ref=${currentRef}` : ""
            }`}
            aria-current={active ? "true" : undefined}
            className={cn(
              "rounded px-3 py-1 text-sm transition-colors",
              active
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
