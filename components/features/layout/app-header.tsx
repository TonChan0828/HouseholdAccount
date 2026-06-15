"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, PiggyBank, Plus, Repeat, Tags, UserCog } from "lucide-react";

import { NAV_ITEMS, isNavActive } from "@/components/features/layout/nav-items";
import { ThemeMenuItems } from "@/components/features/layout/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Props = {
  /** アクティブな家計簿グループ名 */
  householdName: string;
  /** ログイン中ユーザーの表示名 */
  displayName: string;
  /** ログアウト用 Server Action */
  signOutAction: () => Promise<void>;
};

/** 全ページ共通のスティッキーヘッダー（ロゴ・ナビ・ユーザーメニュー）。 */
export function AppHeader({ householdName, displayName, signOutAction }: Props) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft">
            <PiggyBank className="size-5" aria-hidden />
          </span>
          <span className="font-heading text-base font-bold tracking-wide">
            Shallet
          </span>
        </Link>

        <nav aria-label="メイン" className="ml-2 hidden flex-1 items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = isNavActive(pathname, item.href);
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
          <Link
            href="/transactions/new"
            className={cn(
              buttonVariants({ size: "sm" }),
              "hidden rounded-full shadow-soft md:inline-flex",
            )}
          >
            <Plus className="size-4" aria-hidden />
            収支を記録
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex items-center gap-2 rounded-full border border-border/70 bg-card py-1 pl-1 pr-3 text-sm shadow-soft transition-colors hover:bg-accent/60"
              aria-label={`${displayName} のメニュー`}
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-secondary font-heading text-xs font-bold text-secondary-foreground">
                {displayName.charAt(0).toUpperCase()}
              </span>
              <span className="max-w-24 truncate">{displayName}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="space-y-0.5">
                  <span className="block text-xs font-normal text-muted-foreground">
                    いまのグループ
                  </span>
                  <span className="block truncate font-heading text-sm text-foreground">
                    {householdName}
                  </span>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href="/households" />}>
                <Repeat aria-hidden />
                グループを切り替え
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/categories" />}>
                <Tags aria-hidden />
                カテゴリ管理
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/settings" />}>
                <UserCog aria-hidden />
                プロフィール設定
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <ThemeMenuItems />
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => void signOutAction()}
              >
                <LogOut aria-hidden />
                ログアウト
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
