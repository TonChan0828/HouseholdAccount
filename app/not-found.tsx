import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Surface } from "@/components/shared/surface";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 items-center p-4 sm:py-8">
      <Surface variant="raised" className="w-full">
        <CardContent className="space-y-4 py-12 text-center">
          <p className="font-mono text-sm text-muted-foreground">404</p>
          <h1 className="font-heading text-xl font-bold">
            ページが見つかりません
          </h1>
          <p className="text-sm text-muted-foreground">
            対象が削除されたか、アクセスできない可能性があります。
          </p>
          <Link href="/dashboard" className={buttonVariants()}>
            ダッシュボードへ戻る
          </Link>
        </CardContent>
      </Surface>
    </main>
  );
}
