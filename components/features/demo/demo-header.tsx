"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  DEMO_NAV_ITEMS,
  isDemoNavActive,
} from "@/components/features/demo/demo-nav-items";
import { ThemeToggleButton } from "@/components/features/layout/theme-toggle";
import { ShalletLogo } from "@/components/shallet-logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** デモモード用の簡易ヘッダー。認証依存はなく、リンク先はすべて /demo 配下。 */
export function DemoHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4">
        <Link
          href="/demo/dashboard"
          className="flex shrink-0 items-center gap-2"
        >
          <ShalletLogo className="size-9 shrink-0 rounded-[10px] shadow-soft" />
          <span className="font-heading text-base font-bold tracking-wide">
            Shallet
          </span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
            デモ
          </span>
        </Link>

        <nav
          aria-label="デモナビ"
          className="ml-4 hidden flex-1 items-center gap-1 lg:flex"
        >
          {DEMO_NAV_ITEMS.map((item) => {
            const active = isDemoNavActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-secondary font-semibold text-secondary-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggleButton />
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "rounded-full",
            )}
          >
            デモを終了
          </Link>
        </div>
      </div>
    </header>
  );
}
