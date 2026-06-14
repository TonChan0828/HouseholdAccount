import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** ページ末尾のグリーン背景の締めCTA。 */
export function FinalCta() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-16">
      <div className="rounded-3xl bg-primary px-6 py-14 text-center shadow-lifted">
        <h2 className="font-heading text-3xl font-bold text-primary-foreground">
          今日から家計を見える化
        </h2>
        <p className="mt-3 text-primary-foreground/85">
          無料で使えます。まずはグループを作ってみましょう。
        </p>
        <Link
          href="/register"
          className={cn(
            buttonVariants({ variant: "secondary", size: "lg" }),
            "mt-8 rounded-full shadow-soft",
          )}
        >
          無料で始める
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
