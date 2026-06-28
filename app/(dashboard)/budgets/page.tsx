import { redirect } from "next/navigation";
import { Wallet } from "lucide-react";

import { BudgetProgressBar } from "@/components/features/budgets/budget-progress-bar";
import { BudgetRowCard } from "@/components/features/budgets/budget-row-card";
import { MonthNav } from "@/components/features/transactions/month-nav";
import { CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { SectionHeading } from "@/components/shared/section-heading";
import { Surface } from "@/components/shared/surface";
import { summarizeCategoryExpense, type TxLite } from "@/lib/analytics";
import { buildBudgetRows } from "@/lib/budget";
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
import { createClient } from "@/lib/supabase/server";
import { yen } from "@/lib/format";
import type { Budget, Category } from "@/types";

export default async function BudgetsPage({
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

  const { periodStartDay: startDay } = await getHouseholdSettings(householdId);
  const range = getPeriodRange(refFromParam(ref), startDay);

  const [{ data: categoryData }, { data: budgetData }, { data: txData }] =
    await Promise.all([
      supabase
        .from("categories")
        .select("id, name, color, type")
        .eq("household_id", householdId)
        .in("type", ["expense", "both"])
        .order("name", { ascending: true }),
      supabase
        .from("budgets")
        .select("category_id, amount")
        .eq("household_id", householdId),
      supabase
        .from("transactions")
        .select(
          "amount, type, date, category_id, category:categories(name, color)",
        )
        .eq("household_id", householdId)
        .gte("date", toISODate(range.start))
        .lt("date", toISODate(range.end))
        .overrideTypes<TxLite[]>(),
    ]);

  const categories = (categoryData ?? []) as Pick<
    Category,
    "id" | "name" | "color"
  >[];
  const budgets = (budgetData ?? []) as Pick<Budget, "category_id" | "amount">[];
  const expenseSlices = summarizeCategoryExpense(txData ?? []);

  const { rows, totalBudget, totalSpent } = buildBudgetRows(
    budgets,
    expenseSlices,
    categories,
  );

  const prevHref = `/budgets?ref=${toISODate(shiftPeriod(range, -1, startDay).start)}`;
  const nextHref = `/budgets?ref=${toISODate(shiftPeriod(range, 1, startDay).start)}`;

  const reveal =
    "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 ease-out";

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:py-8">
      <PageHeader
        eyebrow="管理"
        title="予算"
        className={reveal}
        actions={
          <MonthNav
            label={formatPeriodLabel(range)}
            prevHref={prevHref}
            nextHref={nextHref}
          />
        }
      />

      {categories.length === 0 ? (
        <Surface variant="raised" className={reveal}>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <Wallet className="size-6" aria-hidden />
            </span>
            <p className="text-sm text-muted-foreground">
              支出カテゴリがまだありません。
              <br />
              カテゴリを追加すると予算を設定できます。
            </p>
          </CardContent>
        </Surface>
      ) : (
        <>
          <section className={reveal} style={{ animationDelay: "60ms" }}>
            <Surface variant="raised">
              <CardContent className="space-y-3 py-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    当期の合計予算
                  </span>
                  <span className="font-heading text-lg font-bold tabular-nums">
                    {yen(totalBudget)}
                  </span>
                </div>
                {totalBudget > 0 ? (
                  <BudgetProgressBar spent={totalSpent} budget={totalBudget} />
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    カテゴリに予算を設定すると、ここに予実の合計が表示されます。
                  </p>
                )}
              </CardContent>
            </Surface>
          </section>

          <section className={reveal} style={{ animationDelay: "120ms" }}>
            <SectionHeading>カテゴリ別予算</SectionHeading>
            <div className="grid gap-2 sm:grid-cols-2">
              {rows.map((row) => (
                <BudgetRowCard key={row.categoryId} row={row} />
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
