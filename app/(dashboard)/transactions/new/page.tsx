import Link from "next/link";
import { redirect } from "next/navigation";

import { createTransaction } from "@/app/(dashboard)/transactions/actions";
import { TransactionForm } from "@/components/features/transactions/transaction-form";
import { buttonVariants } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Surface } from "@/components/shared/surface";
import { getActiveHouseholdId, getUserHouseholds } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/types";

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  // ダッシュボード等から表示中の期間を引き継ぐ。不正値は無視してフォーム側の既定（今日）に委ねる。
  const defaultDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;

  const supabase = await createClient();
  const householdId = await getActiveHouseholdId();
  if (!householdId) {
    redirect("/households");
  }

  const { data } = await supabase
    .from("categories")
    .select("*")
    .eq("household_id", householdId)
    .order("type", { ascending: true })
    .order("name", { ascending: true });
  const categories = (data ?? []) as Category[];

  // 反映元（アクティブグループ）を除く自分の所属グループを反映先候補にする。
  const otherHouseholds = (await getUserHouseholds()).filter(
    (h) => h.id !== householdId,
  );

  const reveal =
    "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 ease-out";

  return (
    <main className="mx-auto w-full max-w-md space-y-5 p-4 sm:py-8">
      <PageHeader eyebrow="記録" title="収支を追加" className={reveal} />
      <Surface
        variant="raised"
        className={reveal}
        style={{ animationDelay: "60ms" }}
      >
        <CardContent className="pt-6">
          <TransactionForm
            action={createTransaction}
            categories={categories}
            submitLabel="登録する"
            enableContinue
            otherHouseholds={otherHouseholds}
            defaultValues={defaultDate ? { date: defaultDate } : undefined}
          />
        </CardContent>
      </Surface>
      <div className="text-center">
        <Link
          href="/transactions"
          className={buttonVariants({ variant: "link" })}
        >
          一覧へ戻る
        </Link>
      </div>
    </main>
  );
}
