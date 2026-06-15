"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";

import { TAB_ITEMS, isNavActive } from "@/components/features/layout/nav-items";
import { cn } from "@/lib/utils";

/** モバイル専用の下部固定タブバー。中央に「記録」FAB を置く。 */
export function MobileTabBar() {
  const pathname = usePathname();
  const [left, right] = [TAB_ITEMS.slice(0, 2), TAB_ITEMS.slice(2)];

  const renderTab = (item: (typeof TAB_ITEMS)[number]) => {
    const active = isNavActive(pathname, item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] transition-colors",
          active
            ? "font-semibold text-primary"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Icon className={cn("size-5", active && "drop-shadow-sm")} aria-hidden />
        {item.label}
      </Link>
    );
  };

  return (
    <nav
      aria-label="モバイルナビ"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <div className="mx-auto flex max-w-md items-center px-2 py-1">
        {left.map(renderTab)}
        <Link
          href="/transactions/new"
          className="mx-2 -mt-6 flex size-14 shrink-0 flex-col items-center justify-center gap-0 rounded-full bg-primary text-primary-foreground shadow-lifted transition-transform hover:scale-105 active:scale-95"
        >
          <Plus className="size-6" aria-hidden />
          <span className="text-[10px] font-semibold">記録</span>
        </Link>
        {right.map(renderTab)}
      </div>
    </nav>
  );
}
