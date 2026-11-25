import Link from "next/link";
import { notFound } from "next/navigation";

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
import { getHouseholdMemberNames } from "@/lib/queries/members";
import { unwrapData } from "@/lib/queries/result";
import { canEditTransaction } from "@/lib/transactions/attribution";
import type { Category } from "@/types";

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { user, householdId, supabase } = await requireDashboardContext();

  const transactionResult = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .eq("household_id", householdId)
    .maybeSingle();
  const transaction = unwrapData(transactionResult, "fetchEditableTransaction");

  // 存在しない、または入力者本人でも名義人でもなければ一覧へ戻す（spec 41。RLS と同条件）。
  if (!transaction || !canEditTransaction(transaction, user.id)) {
    notFound();
  }

  const categoryResult = await supabase
    .from("categories")
    .select("*")
    .eq("household_id", householdId)
    .order("type", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  const data = unwrapData(categoryResult, "fetchTransactionFormCategories");
  const categories = (data ?? []) as Category[];

  // 反映元（アクティブグループ）を除く自分の所属グループを反映先候補にする。
  const households = await getUserHouseholds();
  const household = households.find((group) => group.id === householdId);
  const otherHouseholds = households.filter((group) => group.id !== householdId);

  // 名義人セレクト（代理入力。spec 41）の選択肢。
  const members = await getHouseholdMemberNames(householdId);

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
            household={household}
            submitLabel="更新する"
            members={members}
            currentUserId={user.id}
            defaultValues={{
              id: transaction.id,
              type: transaction.type,
              amount: transaction.amount,
              date: transaction.date,
              category_id: transaction.category_id,
              memo: transaction.memo,
              on_behalf_of: transaction.on_behalf_of,
              is_shared: transaction.is_shared,
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
