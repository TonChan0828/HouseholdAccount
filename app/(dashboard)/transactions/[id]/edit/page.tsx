import Link from "next/link";
import { redirect } from "next/navigation";

import {
  deleteTransaction,
  updateTransaction,
} from "@/app/(dashboard)/transactions/actions";
import { ReflectToGroups } from "@/components/features/transactions/reflect-to-groups.client";
import { TransactionForm } from "@/components/features/transactions/transaction-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Surface } from "@/components/shared/surface";
import {
  getUserHouseholds,
  requireDashboardContext,
} from "@/lib/household";
import type { Category } from "@/types";

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { user, householdId, supabase } = await requireDashboardContext();

  const { data: transaction } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  // 存在しない、または登録者本人でなければ一覧へ戻す（編集は本人のみ）。
  if (!transaction || transaction.created_by !== user.id) {
    redirect("/transactions");
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
      <PageHeader eyebrow="記録" title="収支を編集" className={reveal} />
      <Surface
        variant="raised"
        className={reveal}
        style={{ animationDelay: "60ms" }}
      >
        <CardContent className="space-y-4 pt-6">
          <TransactionForm
            action={updateTransaction}
            categories={categories}
            submitLabel="更新する"
            defaultValues={{
              id: transaction.id,
              type: transaction.type,
              amount: transaction.amount,
              date: transaction.date,
              category_id: transaction.category_id,
              memo: transaction.memo,
            }}
          />
          {otherHouseholds.length > 0 ? (
            <ReflectToGroups
              transactionId={transaction.id}
              otherHouseholds={otherHouseholds}
            />
          ) : null}
          <form action={deleteTransaction} className="border-t pt-4">
            <input type="hidden" name="id" value={transaction.id} />
            <Button type="submit" variant="destructive" className="w-full">
              この収支を削除
            </Button>
          </form>
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
