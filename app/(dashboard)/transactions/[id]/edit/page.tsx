import Link from "next/link";
import { redirect } from "next/navigation";

import {
  deleteTransaction,
  updateTransaction,
} from "@/app/(dashboard)/transactions/actions";
import { TransactionForm } from "@/components/features/transactions/transaction-form";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getActiveHouseholdId, getCurrentUser } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/types";

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const householdId = await getActiveHouseholdId();
  if (!householdId) {
    redirect("/households");
  }

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

  return (
    <main className="mx-auto w-full max-w-md space-y-4 p-4 sm:py-8">
      <Card>
        <CardHeader>
          <CardTitle>収支を編集</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
          <form action={deleteTransaction} className="border-t pt-4">
            <input type="hidden" name="id" value={transaction.id} />
            <Button
              type="submit"
              variant="destructive"
              className="w-full"
            >
              この収支を削除
            </Button>
          </form>
        </CardContent>
      </Card>
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
