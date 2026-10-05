"use client";

import { useActionState, useRef, useState } from "react";
import { unstable_rethrow } from "next/navigation";
import { Trash2 } from "lucide-react";

import { deleteTransaction } from "@/app/(dashboard)/transactions/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { yen } from "@/lib/format";
import type { TransactionType } from "@/types";

type Props = {
  transaction: {
    id: string;
    date: string;
    amount: number;
    type: TransactionType;
    memo: string | null;
  };
};

export function DeleteTransactionButton({ transaction }: Props) {
  const [open, setOpen] = useState(false);
  const submitting = useRef(false);
  const [error, action, pending] = useActionState(
    async (_previous: string | null, formData: FormData) => {
      try {
        await deleteTransaction(formData);
        setOpen(false);
        return null;
      } catch (error) {
        // Preserve Next.js redirects (including an expired login session).
        unstable_rethrow(error);
        return "収支の削除に失敗しました。時間をおいて再度お試しください。";
      } finally {
        submitting.current = false;
      }
    },
    null,
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!submitting.current) setOpen(nextOpen);
      }}
    >
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="削除"
            className="size-8 text-muted-foreground hover:text-destructive"
          />
        }
      >
        <Trash2 className="size-4" aria-hidden />
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>収支を削除しますか？</DialogTitle>
          <DialogDescription>
            以下の収支を削除します。削除した収支は元に戻せません。
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <dt className="text-muted-foreground">日付</dt>
          <dd>{transaction.date}</dd>
          <dt className="text-muted-foreground">種別</dt>
          <dd>{transaction.type === "income" ? "収入" : "支出"}</dd>
          <dt className="text-muted-foreground">金額</dt>
          <dd>{yen(transaction.amount)}</dd>
          {transaction.memo ? (
            <>
              <dt className="text-muted-foreground">メモ</dt>
              <dd className="break-words">{transaction.memo}</dd>
            </>
          ) : null}
        </dl>
        <form
          action={action}
          onSubmit={(event) => {
            if (submitting.current) {
              event.preventDefault();
              return;
            }
            submitting.current = true;
          }}
        >
          <input type="hidden" name="id" value={transaction.id} />
          {error ? <p role="alert" className="mb-4 text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
              autoFocus
            >
              キャンセル
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "削除中…" : "削除する"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
