import Link from "next/link";

/** 公開ランディング用のフッター。 */
export function LandingFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
        <p>© {new Date().getFullYear()} Shallet</p>
        <nav className="flex items-center gap-4" aria-label="フッター">
          <Link href="/login" className="hover:text-foreground">
            ログイン
          </Link>
          <Link href="/register" className="hover:text-foreground">
            新規登録
          </Link>
        </nav>
      </div>
    </footer>
  );
}
