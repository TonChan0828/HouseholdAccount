"use client";

import Link from "next/link";

import { useDemo } from "@/components/features/demo/demo-provider";
import { TransactionForm } from "@/components/features/transactions/transaction-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DemoNewTransactionPage() {
  const { categories, createTransactionAction } = useDemo();

  return (
    <main className="mx-auto w-full max-w-md space-y-4 p-4 sm:py-8">
      <Card>
        <CardHeader>
          <CardTitle>収支を追加</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionForm
            action={createTransactionAction}
            categories={categories}
            submitLabel="登録する"
          />
        </CardContent>
      </Card>
      <div className="text-center">
        <Link
          href="/demo/transactions"
          className={buttonVariants({ variant: "link" })}
        >
          一覧へ戻る
        </Link>
      </div>
    </main>
  );
}
