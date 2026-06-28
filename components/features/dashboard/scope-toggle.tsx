import Link from "next/link";
import { User, Users } from "lucide-react";

import { cn } from "@/lib/utils";

export type DashboardScope = "all" | "mine";

type Props = {
  scope: DashboardScope;
  /** 表示中の期間（ref クエリ）。指定時はリンクに引き継いで月を維持する。 */
  currentRef?: string;
  /** 追加クラス（レイアウト調整用）。 */
  className?: string;
};

const items: { value: DashboardScope; label: string; icon: typeof Users }[] = [
  { value: "all", label: "全体", icon: Users },
  { value: "mine", label: "自分", icon: User },
];

/**
 * 全体/自分の絞り込みセグメントピル。現在値を強調する（presentational）。
 * MonthNav / ViewToggle と同じピル意匠（soft card 枠＋secondary アクティブ）で統一する。
 */
export function ScopeToggle({ scope, currentRef, className }: Props) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border bg-card/70 p-1 shadow-soft ring-1 ring-foreground/5 backdrop-blur",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === scope;
        const Icon = item.icon;
        return (
          <Link
            key={item.value}
            href={`/dashboard?scope=${item.value}${
              currentRef ? `&ref=${currentRef}` : ""
            }`}
            aria-current={active ? "true" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors",
              active
                ? "bg-secondary text-secondary-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
