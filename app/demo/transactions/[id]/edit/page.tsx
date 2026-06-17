"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

import { useDemo } from "@/components/features/demo/demo-provider";
import { TransactionForm } from "@/components/features/transactions/transaction-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DemoEditTransactionPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const {
    categories,
    currentUserId,
    getRow,
    updateTransactionAction,
    deleteTransactionAction,
  } = useDemo();

  const row = getRow(params.id);
  // 存在しない・他メンバーの収支は編集できない（本人のみ）。
  const editable = row && row.created_by === currentUserId;

  useEffect(() => {
    if (!editable) {
      router.replace("/demo/transactions");
    }
  }, [editable, router]);

  if (!row || !editable) {
    return null;
  }

  return (
    <main className="mx-auto w-full max-w-md space-y-4 p-4 sm:py-8">
      <Card>
        <CardHeader>
          <CardTitle>収支を編集</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TransactionForm
            action={updateTransactionAction}
            categories={categories}
            submitLabel="更新する"
            defaultValues={{
              id: row.id,
              type: row.type,
              amount: row.amount,
              date: row.date,
              category_id: row.category_id,
              memo: row.memo,
            }}
          />
          <form action={deleteTransactionAction} className="border-t pt-4">
            <input type="hidden" name="id" value={row.id} />
            <Button type="submit" variant="destructive" className="w-full">
              この収支を削除
            </Button>
          </form>
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
