import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** ランディングのヒーロー。PC は左テキスト＋右プレビューの非対称、スマホは中央寄せ縦積み。 */
export function Hero() {
  return (
    <section className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-16 md:grid-cols-2 md:items-center md:py-24">
      <div className="text-center md:text-left">
        <span className="inline-block rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground">
          家族で使う家計簿
        </span>
        <h1 className="mt-4 font-heading text-4xl leading-tight font-extrabold text-foreground md:text-5xl">
          家計を、
          <br />
          みんなで一緒に。
        </h1>
        <p className="mt-4 text-muted-foreground md:text-lg">
          グループで収支を共有し、月次で自動集計。誰が何に使ったか一目で分かる。
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center md:justify-start">
          <Link
            href="/register"
            className={cn(
              buttonVariants({ size: "lg" }),
              "w-full rounded-full shadow-soft sm:w-auto",
            )}
          >
            無料で始める
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link
            href="/demo"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "w-full rounded-full sm:w-auto",
            )}
          >
            ログインせずに試す
          </Link>
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "ghost", size: "lg" }),
              "w-full rounded-full sm:w-auto",
            )}
          >
            ログイン
          </Link>
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground md:text-left">
          登録不要・その場で操作できます（データは保存されません）。
        </p>
      </div>

      {/* アプリプレビュー（CSS のみのモック）。背後にやわらかい光を敷く。 */}
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-6 -z-10 rounded-[2.5rem] bg-accent-warm/20 blur-3xl"
        />
        <div className="rounded-[1.75rem] border border-border/60 bg-card p-5 shadow-[var(--shadow-pillow)] ring-1 ring-foreground/5">
          <p className="text-xs text-muted-foreground">今月の収支</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-income-soft p-3">
              <p className="text-xs text-income">収入</p>
              <p className="font-heading text-lg font-bold text-income">
                ¥320,000
              </p>
            </div>
            <div className="rounded-xl bg-expense-soft p-3">
              <p className="text-xs text-expense">支出</p>
              <p className="font-heading text-lg font-bold text-expense">
                ¥198,400
              </p>
            </div>
          </div>
          <div className="mt-4 flex h-24 items-end gap-2" aria-hidden>
            {[50, 80, 60, 95, 65, 82].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-primary/80"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
