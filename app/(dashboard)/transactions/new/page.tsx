import Link from "next/link";
import { redirect } from "next/navigation";

import { createTransaction } from "@/app/(dashboard)/transactions/actions";
import { TransactionForm } from "@/components/features/transactions/transaction-form";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getActiveHouseholdId } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/types";

export default async function NewTransactionPage() {
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

  return (
    <main className="mx-auto w-full max-w-md space-y-4 p-4 sm:py-8">
      <Card>
        <CardHeader>
          <CardTitle>収支を追加</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionForm
            action={createTransaction}
            categories={categories}
            submitLabel="登録する"
          />
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
