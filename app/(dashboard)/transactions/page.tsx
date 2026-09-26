import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ReceiptText,
  Repeat,
  Trash2,
  Upload,
} from "lucide-react";

import { deleteTransaction } from "@/app/(dashboard)/transactions/actions";
import { SummaryCards } from "@/components/features/dashboard/summary-cards";
import { CategoryBadge } from "@/components/features/transactions/category-badge";
import { FilterBar } from "@/components/features/transactions/filter-bar";
import { MonthNav } from "@/components/features/transactions/month-nav";
import {
  EditTransactionButton,
  NewTransactionButton,
  TransactionDialogProvider,
} from "@/components/features/transactions/transaction-dialog";
import { ViewToggle } from "@/components/features/transactions/view-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Amount } from "@/components/shared/amount";
import { PageHeader } from "@/components/shared/page-header";
import { Surface } from "@/components/shared/surface";
import { formatDayLabel, groupByDate } from "@/lib/format";
import {
  getHouseholdSettings,
  getUserHouseholds,
  requireDashboardContext,
} from "@/lib/household";
import { fetchHouseholdCategories } from "@/lib/queries/categories";
import {
  formatPeriodLabel,
  getPeriodRange,
  refFromParam,
  shiftPeriod,
  toISODate,
} from "@/lib/period";
import { getHouseholdMemberNames } from "@/lib/queries/members";
import {
  fetchTransactionPage,
  fetchTransactionsInRange,
  type TransactionRow,
} from "@/lib/queries/transactions";
import {
  buildFilterQueryString,
  hasActiveFilter,
  parseTransactionFilter,
  type TransactionFilterParams,
} from "@/lib/transaction-filter";
import {
  canEditTransaction,
  isProxyEntry,
  proxyLabel,
} from "@/lib/transactions/attribution";
import { cn } from "@/lib/utils";

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
  searchParams: Promise<
    {
      ref?: string;
      cursor?: string;
      imported?: string;
      duplicates?: string;
    } & TransactionFilterParams
  >;
}) {
  const { ref, cursor, imported, duplicates, ...filterParams } = await searchParams;
  const filter = parseTransactionFilter(filterParams);
  const filtering = hasActiveFilter(filter);

  const { user, householdId, supabase } = await requireDashboardContext();

  const { periodStartDay: startDay } = await getHouseholdSettings(householdId);

  const range = getPeriodRange(refFromParam(ref), startDay);

  // 編集ダイアログ（spec 40）に必要な値もここで揃える。カテゴリは絞り込みバーと共用し、
  // 所属グループ一覧は layout で cache() 済みのため追加の DB 往復は発生しない。
  const [transactions, transactionPage, members, categoryOptions, households] =
    await Promise.all([
      fetchTransactionsInRange(supabase, householdId, range, { filter }),
      fetchTransactionPage(supabase, householdId, range, { filter, cursor }),
      getHouseholdMemberNames(householdId),
      fetchHouseholdCategories(supabase, householdId),
      getUserHouseholds(),
    ]);
  const otherHouseholds = households.filter((h) => h.id !== householdId);
  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const expense = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const groups = groupByDate(transactionPage.items);

  // 前月/翌月リンクにはフィルタ条件を引き継ぐ（期間移動で条件が消えないように）
  const filterQs = buildFilterQueryString(filter);
  const filterSuffix = filterQs ? `&${filterQs}` : "";
  const prevHref = `/transactions?ref=${toISODate(shiftPeriod(range, -1, startDay).start)}${filterSuffix}`;
  const nextHref = `/transactions?ref=${toISODate(shiftPeriod(range, 1, startDay).start)}${filterSuffix}`;

  const pageHref = (pageCursor: string) => {
    const params = new URLSearchParams(filterQs);
    if (ref) params.set("ref", ref);
    if (pageCursor !== "0") params.set("cursor", pageCursor);
    const query = params.toString();
    return `/transactions${query ? `?${query}` : ""}`;
  };

  // 代理入力（spec 41）の補助ラベル用。メンバー名は上で取得済み。
  const nameById = new Map(members.map((m) => [m.user_id, m.display_name]));

  const reveal =
    "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 ease-out";
  const importedValue = Number(imported);
  const duplicateValue = Number(duplicates);
  const importSummary =
    imported !== undefined &&
    duplicates !== undefined &&
    /^\d+$/.test(imported) &&
    /^\d+$/.test(duplicates) &&
    Number.isSafeInteger(importedValue) &&
    Number.isSafeInteger(duplicateValue) &&
    importedValue + duplicateValue <= 500
      ? { imported: importedValue, duplicates: duplicateValue }
      : null;

  return (
    <TransactionDialogProvider
      categories={categoryOptions}
      otherHouseholds={otherHouseholds}
      members={members}
      currentUserId={user.id}
    >
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
              <NewTransactionButton />
            </>
          }
        />

        {importSummary ? (
          <p
            className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm"
            role="status"
          >
            Excel 取込: 新規 {importSummary.imported} 件
            {importSummary.duplicates > 0
              ? `・重複 ${importSummary.duplicates} 件をスキップしました。`
              : "を登録しました。"}
          </p>
        ) : null}

        <div
          className={cn("flex flex-col items-center gap-3", reveal)}
          style={{ animationDelay: "60ms" }}
        >
          <ViewToggle active="list" />
          <MonthNav
            label={formatPeriodLabel(range)}
            prevHref={prevHref}
            nextHref={nextHref}
          />
        </div>

        <div className={reveal} style={{ animationDelay: "90ms" }}>
          <FilterBar
            filter={filter}
            currentRef={ref}
            categories={categoryOptions}
            members={members}
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
              {filtering ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    条件に一致する収支がありません。
                  </p>
                  <Link
                    href={`/transactions${ref ? `?ref=${ref}` : ""}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    条件をクリア
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    この期間の収支はまだありません。
                  </p>
                  <Link
                    href="/transactions/new"
                    className={buttonVariants({ size: "sm" })}
                  >
                    収支を記録
                  </Link>
                </>
              )}
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
                      // 編集・削除できるのは入力者と名義人（spec 41。RLS と同条件）。
                      const editable = canEditTransaction(t, user.id);
                      const proxy = isProxyEntry(t)
                        ? proxyLabel(t, nameById)
                        : null;
                      // 代理でなく自分の記録でもない＝他メンバーが自分名義で記録したもの。
                      const othersOwn =
                        !proxy && t.created_by !== user.id;
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
                              <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3">
                                <div className="min-w-0 space-y-0.5">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <CategoryBadge category={t.category} />
                                    {t.is_shared ? (
                                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                                        精算
                                      </span>
                                    ) : null}
                                    {proxy ? (
                                      <span
                                        data-testid="proxy-badge"
                                        className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                                      >
                                        {proxy}
                                      </span>
                                    ) : null}
                                    {othersOwn ? (
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
                                  {editable ? (
                                    <div className="flex items-center transition-opacity sm:opacity-0 sm:group-hover/row:opacity-100 sm:group-focus-within/row:opacity-100">
                                      <EditTransactionButton
                                        transaction={{
                                          id: t.id,
                                          type: t.type,
                                          amount: t.amount,
                                          date: t.date,
                                          category_id: t.category_id,
                                          memo: t.memo,
                                          created_by: t.created_by,
                                          on_behalf_of: t.on_behalf_of,
                                          is_shared: t.is_shared,
                                        }}
                                      />
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
            {transactionPage.previousCursor || transactionPage.nextCursor ? (
              <nav className="flex items-center justify-center gap-3" aria-label="収支一覧ページ">
                {transactionPage.previousCursor !== null ? (
                  <Link
                    href={pageHref(transactionPage.previousCursor)}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <ChevronLeft className="size-4" aria-hidden />
                    前へ
                  </Link>
                ) : null}
                {transactionPage.nextCursor !== null ? (
                  <Link
                    href={pageHref(transactionPage.nextCursor)}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    次へ
                    <ChevronRight className="size-4" aria-hidden />
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </div>
        )}
      </main>
    </TransactionDialogProvider>
  );
}
