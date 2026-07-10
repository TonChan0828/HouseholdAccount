import Link from "next/link";
import { TriangleAlert } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CategoryReminderTarget } from "@/lib/reminder";
import { cn } from "@/lib/utils";

type Props = {
  categories: CategoryReminderTarget[];
  daysRemaining: number;
  newTransactionHref: string;
  className?: string;
};

/** 通知ONのカテゴリのうち当期まだ登録が無いものを列挙するリマインダーカード。 */
export function UnrecordedCategoriesReminderCard({
  categories,
  daysRemaining,
  newTransactionHref,
  className,
}: Props) {
  return (
    <Card
      data-testid="unrecorded-categories-reminder"
      className={cn(
        "border border-amber-300 bg-amber-50 shadow-soft ring-0 dark:border-amber-500/40 dark:bg-amber-500/10",
        className,
      )}
    >
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
            <TriangleAlert className="size-4" aria-hidden />
          </span>
          <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
            カテゴリの登録漏れ
          </span>
          <span className="ml-auto shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
            残り{daysRemaining}日
          </span>
        </div>
        <div className="space-y-1.5">
          <p className="text-sm leading-relaxed">
            次のカテゴリは今月まだ登録がありません。
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <li
                key={c.id}
                className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
              >
                {c.name}
              </li>
            ))}
          </ul>
        </div>
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
