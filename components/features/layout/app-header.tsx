"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp, LogOut, Plus, Repeat, Tags, UserCog } from "lucide-react";

import { HouseholdSwitcher } from "@/components/features/layout/household-switcher";
import { NAV_ITEMS, isNavActive } from "@/components/features/layout/nav-items";
import { ShalletLogo } from "@/components/shallet-logo";
import { ThemeMenuItems } from "@/components/features/layout/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Props = {
  /** ログイン中ユーザーが所属する全グループ */
  households: { id: string; name: string }[];
  /** 現在アクティブなグループ ID */
  activeHouseholdId: string;
  /** アクティブグループを切り替える Server Action */
  switchAction: (formData: FormData) => Promise<void>;
  /** ログイン中ユーザーの表示名 */
  displayName: string;
  /** ログアウト用 Server Action */
  signOutAction: () => Promise<void>;
};

/** 全ページ共通のスティッキーヘッダー（ロゴ・グループ切替・ナビ・ユーザーメニュー）。 */
export function AppHeader({
  households,
  activeHouseholdId,
  switchAction,
  displayName,
  signOutAction,
}: Props) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
          <ShalletLogo className="size-9 shrink-0 rounded-[10px] shadow-[var(--shadow-pillow)]" />
          <span className="hidden font-heading text-base font-bold tracking-wide sm:inline">
            Shallet
          </span>
        </Link>

        <HouseholdSwitcher
          households={households}
          activeId={activeHouseholdId}
          switchAction={switchAction}
        />

        <nav aria-label="メイン" className="ml-2 hidden flex-1 items-center gap-1 lg:flex">
          {NAV_ITEMS.map((item) => {
            const active = isNavActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors",
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
              "hidden whitespace-nowrap rounded-full shadow-[var(--shadow-pillow)] lg:inline-flex",
            )}
          >
            <Plus className="size-4" aria-hidden />
            収支を記録
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex items-center gap-2 rounded-full border border-border/70 bg-card py-1 pl-1 pr-1 text-sm shadow-[var(--shadow-pillow)] transition-colors hover:bg-accent/60 sm:pr-3"
              aria-label={`${displayName} のメニュー`}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary font-heading text-xs font-bold text-secondary-foreground">
                {displayName.charAt(0).toUpperCase()}
              </span>
              <span className="hidden max-w-24 truncate sm:inline">
                {displayName}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem render={<Link href="/transactions/recurring" />}>
                <Repeat aria-hidden />
                定期項目
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/categories" />}>
                <Tags aria-hidden />
                カテゴリ管理
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/settings" />}>
                <UserCog aria-hidden />
                プロフィール設定
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/help" />}>
                <CircleHelp aria-hidden />
                ヘルプ
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
