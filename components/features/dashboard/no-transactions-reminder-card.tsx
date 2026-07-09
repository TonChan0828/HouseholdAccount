import Link from "next/link";
import { TriangleAlert } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  daysRemaining: number;
  newTransactionHref: string;
  className?: string;
};

/** 月末未記録リマインダー（当期の残り日数が閾値以内かつ登録0件のときのみ描画）。 */
export function NoTransactionsReminderCard({
  daysRemaining,
  newTransactionHref,
  className,
}: Props) {
  return (
    <Card
      data-testid="no-transactions-reminder"
      className={cn("shadow-soft", className)}
    >
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
            <TriangleAlert className="size-4" aria-hidden />
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            月末リマインダー
          </span>
        </div>
        <p className="text-sm leading-relaxed">
          今月はまだ収支が登録されていません。月末まで残り{daysRemaining}
          日です。
        </p>
        <Link
          href={newTransactionHref}
          className={cn(buttonVariants({ size: "sm" }), "w-full")}
        >
          収支を記録
        </Link>
      </CardContent>
    </Card>
  );
}
