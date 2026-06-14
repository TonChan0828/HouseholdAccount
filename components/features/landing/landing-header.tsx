import Link from "next/link";
import { PiggyBank } from "lucide-react";

import { ThemeToggleButton } from "@/components/features/layout/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** 公開ランディング用のヘッダー（ロゴ・アンカーナビ・テーマ・認証導線）。 */
export function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft">
            <PiggyBank className="size-5" aria-hidden />
          </span>
          <span className="font-heading text-base font-bold tracking-wide">
            家計簿アプリ
          </span>
        </Link>

        <nav
          aria-label="セクション"
          className="ml-4 hidden flex-1 items-center gap-1 md:flex"
        >
          <a
            href="#features"
            className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            機能
          </a>
          <a
            href="#steps"
            className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            使い方
          </a>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggleButton />
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "rounded-full",
            )}
          >
            ログイン
          </Link>
          <Link
            href="/register"
            className={cn(
              buttonVariants({ size: "sm" }),
              "rounded-full shadow-soft",
            )}
          >
            無料で始める
          </Link>
        </div>
      </div>
    </header>
  );
}
