import Link from "next/link";
import { Pencil, Plus, Repeat } from "lucide-react";

import { toggleRecurringActive } from "@/app/(dashboard)/transactions/recurring/actions";
import { CategoryBadge } from "@/components/features/transactions/category-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Amount } from "@/components/shared/amount";
import { PageHeader } from "@/components/shared/page-header";
import { Surface } from "@/components/shared/surface";
import {
  getHouseholdSettings,
  requireDashboardContext,
} from "@/lib/household";
import { cn } from "@/lib/utils";

type RecurringRow = {
  id: string;
  amount: number;
  type: "income" | "expense";
  memo: string | null;
  is_active: boolean;
  created_by: string;
  category: { name: string; color: string | null } | null;
};

export default async function RecurringTransactionsPage() {
  const { user, householdId, supabase } = await requireDashboardContext();

  const { periodStartDay } = await getHouseholdSettings(householdId);

  const { data } = await supabase
    .from("recurring_transactions")
    .select(
      "id, amount, type, memo, is_active, created_by, category:categories(name, color)",
    )
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .overrideTypes<RecurringRow[]>();
  const items = data ?? [];

  // 登録者名の解決（グループ毎の表示名優先・未設定はグローバル名へ）。
  const { data: memberRows } = await supabase
    .from("household_members")
    .select("user_id, display_name")
    .eq("household_id", householdId);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", (memberRows ?? []).map((m) => m.user_id));
  const globalName = new Map(
    (profiles ?? []).map((p) => [p.id, p.display_name]),
  );
  const nameByUser = new Map(
    (memberRows ?? []).map((m) => [
      m.user_id,
      m.display_name ?? globalName.get(m.user_id) ?? "不明なユーザー",
    ]),
  );

  const reveal =
    "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 ease-out";

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:py-8">
      <PageHeader
        eyebrow="記録"
        title="定期項目"
        meta={`毎月${periodStartDay}日に自動登録`}
        className={reveal}
        actions={
          <Link
            href="/transactions/recurring/new"
            className={buttonVariants({ variant: "default", size: "sm" })}
          >
            <Plus className="size-4" aria-hidden />
            定期項目を追加
          </Link>
        }
      />

      <p
        className={cn("text-sm text-muted-foreground", reveal)}
        style={{ animationDelay: "60ms" }}
      >
        登録した項目は、毎期のスタート日（{periodStartDay}日）に自動で収支へ登録されます。
      </p>

      {items.length === 0 ? (
        <Surface
          variant="raised"
          className={reveal}
          style={{ animationDelay: "120ms" }}
        >
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <Repeat className="size-6" aria-hidden />
            </span>
            <p className="text-sm text-muted-foreground">
              定期項目はまだありません。
              <br />
              家賃やサブスクなど、毎月の固定収支を登録しましょう。
            </p>
            <Link
              href="/transactions/recurring/new"
              className={buttonVariants({ size: "sm" })}
            >
              定期項目を追加
            </Link>
          </CardContent>
        </Surface>
      ) : (
        <ul
          className={cn("space-y-2", reveal)}
          style={{ animationDelay: "120ms" }}
        >
          {items.map((item) => {
            const mine = item.created_by === user.id;
            return (
              <li key={item.id}>
                <Surface
                  variant="raised"
                  data-testid="recurring-row"
                  className="group/row overflow-hidden p-0 transition-shadow hover:shadow-lifted"
                >
                  <CardContent className="flex items-stretch gap-0 p-0">
                    <span
                      aria-hidden
                      className={cn(
                        "w-1.5 shrink-0",
                        !item.is_active
                          ? "bg-muted-foreground/40"
                          : item.type === "income"
                            ? "bg-income"
                            : "bg-expense",
                      )}
                    />
                    <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <CategoryBadge category={item.category} />
                          {!item.is_active ? (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              停止中
                            </span>
                          ) : null}
                          {!mine ? (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              {nameByUser.get(item.created_by)}
                            </span>
                          ) : null}
                        </div>
                        {item.memo ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {item.memo}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Amount
                          value={item.amount}
                          type={item.type}
                          className={cn(!item.is_active && "opacity-50")}
                        />
                        {mine ? (
                          <div className="flex items-center gap-1">
                            <form action={toggleRecurringActive}>
                              <input type="hidden" name="id" value={item.id} />
                              <input
                                type="hidden"
                                name="is_active"
                                value={item.is_active ? "false" : "true"}
                              />
                              <Button
                                type="submit"
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                              >
                                {item.is_active ? "停止" : "再開"}
                              </Button>
                            </form>
                            <Link
                              href={`/transactions/recurring/${item.id}/edit`}
                              aria-label="編集"
                              className={cn(
                                buttonVariants({
                                  variant: "ghost",
                                  size: "icon",
                                }),
                                "size-8 text-muted-foreground hover:text-foreground",
                              )}
                            >
                              <Pencil className="size-4" aria-hidden />
                            </Link>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </CardContent>
                </Surface>
              </li>
            );
          })}
        </ul>
      )}

      <div className="text-center">
        <Link
          href="/transactions"
          className={buttonVariants({ variant: "link" })}
        >
          収支一覧へ戻る
        </Link>
      </div>
    </main>
  );
}
