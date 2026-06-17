import Link from "next/link";
import { Info } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** デモであること・データが保存されないことを常時知らせ、登録へ誘導するバナー。 */
export function DemoBanner() {
  return (
    <div className="border-b border-primary/20 bg-secondary">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
        <Info className="size-4 shrink-0 text-primary" aria-hidden />
        <p className="text-sm text-secondary-foreground">
          これはデモです。入力したデータは保存されず、ページを更新すると消えます。
        </p>
        <Link
          href="/register"
          className={cn(
            buttonVariants({ size: "sm" }),
            "ml-auto rounded-full shadow-soft",
          )}
        >
          無料で登録して保存
        </Link>
      </div>
    </div>
  );
}
