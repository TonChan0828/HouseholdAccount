import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Download,
  Pencil,
  Plus,
  ReceiptText,
  Repeat,
  Trash2,
  Upload,
} from "lucide-react";

import { deleteTransaction } from "@/app/(dashboard)/transactions/actions";
import { SummaryCards } from "@/components/features/dashboard/summary-cards";
import { CategoryBadge } from "@/components/features/transactions/category-badge";
import { MonthNav } from "@/components/features/transactions/month-nav";
import { Button, buttonVariants } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Amount } from "@/components/shared/amount";
import { PageHeader } from "@/components/shared/page-header";
import { Surface } from "@/components/shared/surface";
import { formatDayLabel, groupByDate } from "@/lib/format";
import {
  getActiveHouseholdId,
  getCurrentUser,
  getHouseholdSettings,
} from "@/lib/household";
import {
  formatPeriodLabel,
  getPeriodRange,
  refFromParam,
  shiftPeriod,
  toISODate,
} from "@/lib/period";
import { ensureRecurringGenerated } from "@/lib/recurring";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type TransactionRow = {
  id: string;
  amount: number;
  type: "income" | "expense";
  date: string;
  memo: string | null;
  created_by: string;
  category: { name: string; color: string | null } | null;
};

/** 1 日分の収入・支出小計を求める。 */
function daySums(items: TransactionRow[]) {
  let income = 0;
  let expense = 0;
  for (const t of items) {
    if (t.type === "income") income += t.amount;
    else expense += t.amount;
  }
  return { income, expense };
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const householdId = await getActiveHouseholdId();
  if (!householdId) {
    redirect("/households");
  }

  // 当期分の定期収支を（未生成なら）生成してから取得する。冪等。
  await ensureRecurringGenerated(householdId);

  const { periodStartDay: startDay } = await getHouseholdSettings(householdId);

  const range = getPeriodRange(refFromParam(ref), startDay);
  const isoStart = toISODate(range.start);
  const isoEnd = toISODate(range.end);

  const { data } = await supabase
    .from("transactions")
    .select("id, amount, type, date, memo, created_by, category:categories(name, color)")
    .eq("household_id", householdId)
    .gte("date", isoStart)
    .lt("date", isoEnd)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .overrideTypes<TransactionRow[]>();

  const transactions = data ?? [];
  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const expense = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const groups = groupByDate(transactions);

  const prevHref = `/transactions?ref=${toISODate(shiftPeriod(range, -1, startDay).start)}`;
  const nextHref = `/transactions?ref=${toISODate(shiftPeriod(range, 1, startDay).start)}`;

  const reveal =
    "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 ease-out";

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:py-8">
      <PageHeader
        eyebrow="記録"
        title="収支"
        meta={`${transactions.length}件の記録`}
        className={reveal}
        actions={
          <>
            {/* Route Handler（CSV）へは素の <a> を使う。<Link> だと RSC を
                プリフェッチしようとして "unexpected response" エラーになる。 */}
            <a
              href={`/transactions/export?ref=${toISODate(range.start)}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Download className="size-4" aria-hidden />
              <span className="max-sm:sr-only">CSV出力</span>
            </a>
            <Link
              href="/transactions/import"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Upload className="size-4" aria-hidden />
              <span className="max-sm:sr-only">インポート</span>
            </Link>
            <Link
              href="/transactions/recurring"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Repeat className="size-4" aria-hidden />
              <span className="max-sm:sr-only">定期項目</span>
            </Link>
            <Link
              href="/transactions/new"
              className={buttonVariants({ variant: "default", size: "sm" })}
            >
              <Plus className="size-4" aria-hidden />
              収支を追加
            </Link>
          </>
        }
      />

      <div
        className={cn("flex justify-center", reveal)}
        style={{ animationDelay: "60ms" }}
      >
        <MonthNav
          label={formatPeriodLabel(range)}
          prevHref={prevHref}
          nextHref={nextHref}
        />
      </div>

      <div className={reveal} style={{ animationDelay: "120ms" }}>
        <SummaryCards income={income} expense={expense} />
      </div>

      {groups.length === 0 ? (
        <Surface
          variant="raised"
          className={cn("", reveal)}
          style={{ animationDelay: "180ms" }}
        >
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <ReceiptText className="size-6" aria-hidden />
            </span>
            <p className="text-sm text-muted-foreground">
              この期間の収支はまだありません。
            </p>
            <Link
              href="/transactions/new"
              className={buttonVariants({ size: "sm" })}
            >
              収支を記録
            </Link>
          </CardContent>
        </Surface>
      ) : (
        <div
          className={cn("space-y-6", reveal)}
          style={{ animationDelay: "180ms" }}
        >
          {groups.map((group) => {
            const sums = daySums(group.items);
            return (
              <section key={group.date} className="space-y-2">
                {/* 台帳の日付見出し。スクロール時はヘッダー直下に貼り付く。 */}
                <div className="sticky top-16 z-20 flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full border bg-card/85 px-3 py-1 font-heading text-xs font-semibold tabular-nums shadow-soft ring-1 ring-foreground/5 backdrop-blur-md">
                    {formatDayLabel(group.date)}
                  </span>
                  <span className="flex items-center gap-2 text-[11px] font-medium tabular-nums">
                    {sums.income > 0 ? (
                      <Amount
                        value={sums.income}
                        type="income"
                        className="text-[11px] font-medium"
                      />
                    ) : null}
                    {sums.expense > 0 ? (
                      <Amount
                        value={sums.expense}
                        type="expense"
                        className="text-[11px] font-medium"
                      />
                    ) : null}
                  </span>
                </div>

                <ul className="space-y-2">
                  {group.items.map((t) => {
                    const mine = t.created_by === user.id;
                    return (
                      <li key={t.id}>
                        <Surface
                          variant="raised"
                          data-testid="transaction-row"
                          className="group/row overflow-hidden p-0 transition-shadow hover:shadow-lifted"
                        >
                          <CardContent className="flex items-stretch gap-0 p-0">
                            {/* タイプ色のレジャーエッジ */}
                            <span
                              aria-hidden
                              className={cn(
                                "w-1.5 shrink-0",
                                t.type === "income"
                                  ? "bg-income"
                                  : "bg-expense",
                              )}
                            />
                            <div className="flex flex-1 items-center justify-between gap-3 px-4 py-3">
                              <div className="min-w-0 space-y-0.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <CategoryBadge category={t.category} />
                                  {!mine ? (
                                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                      他のメンバー
                                    </span>
                                  ) : null}
                                </div>
                                {t.memo ? (
                                  <p className="truncate text-xs text-muted-foreground">
                                    {t.memo}
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <Amount value={t.amount} type={t.type} />
                                {mine ? (
                                  <div className="flex items-center transition-opacity sm:opacity-0 sm:group-hover/row:opacity-100 sm:group-focus-within/row:opacity-100">
                                    <Link
                                      href={`/transactions/${t.id}/edit`}
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
                                    <form action={deleteTransaction}>
                                      <input
                                        type="hidden"
                                        name="id"
                                        value={t.id}
                                      />
                                      <Button
                                        type="submit"
                                        variant="ghost"
                                        size="icon"
                                        aria-label="削除"
                                        className="size-8 text-muted-foreground hover:text-destructive"
                                      >
                                        <Trash2 className="size-4" aria-hidden />
                                      </Button>
                                    </form>
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
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
