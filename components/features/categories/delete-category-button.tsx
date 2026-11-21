"use client";

import { useActionState, useRef, useState } from "react";
import { unstable_rethrow } from "next/navigation";

import type { CategoryActionState } from "@/app/(dashboard)/categories/actions";
import { Label } from "@/components/ui/label";
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

type Props = {
  action: (
    prevState: CategoryActionState,
    formData: FormData,
  ) => CategoryActionState | Promise<CategoryActionState>;
  categoryId: string;
  categoryName: string;
  usage?: { transactions: number; recurring: number; budgets: number };
  destinations?: { id: string; name: string }[];
};

const GENERIC_ERROR = "カテゴリの削除に失敗しました。時間をおいて再度お試しください。";

/**
 * 確認ダイアログを経てカテゴリを削除するボタン。
 * 成功時は action が redirect する。失敗はダイアログ内に表示し、成功に見せない。
 */
export function DeleteCategoryButton({ action, categoryId, categoryName, usage, destinations }: Props) {
  const [destination, setDestination] = useState("");
  const [open, setOpen] = useState(false);
  const submitting = useRef(false);
  const [state, formAction, pending] = useActionState(
    async (previous: CategoryActionState, formData: FormData) => {
      try {
        return await action(previous, formData);
      } catch (error) {
        // redirect（成功時・セッション切れ）はそのまま Next.js に渡す。
        unstable_rethrow(error);
        return { error: GENERIC_ERROR };
      } finally {
        submitting.current = false;
      }
    },
    undefined,
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!submitting.current) {
          setOpen(nextOpen);
          if (!nextOpen) setDestination("");
        }
      }}
    >
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`${categoryName}を削除`}
            data-testid="category-delete"
          />
        }
      >
        削除
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>カテゴリを削除しますか？</DialogTitle>
          <DialogDescription>
            {destination
              ? `「${categoryName}」の参照を移行先に移してから削除します。`
              : `「${categoryName}」を削除します。このカテゴリを使用している収支は「未選択」に変更されます。`}
          </DialogDescription>
        </DialogHeader>
        <form
          action={formAction}
          onSubmit={(event) => {
            if (submitting.current) {
              event.preventDefault();
              return;
            }
            submitting.current = true;
          }}
        >
          <input type="hidden" name="id" value={categoryId} />
          {usage && (
            <p className="mb-3 text-sm">
              収支 {usage.transactions}件・定期収支 {usage.recurring}件・予算 {usage.budgets}件
            </p>
          )}
          {destinations && destinations.length > 0 && (
            <div className="mb-4 grid gap-2">
              <Label htmlFor={`merge-category-${categoryId}`}>移行先カテゴリ</Label>
              <select id={`merge-category-${categoryId}`} name="destination"
                className="w-full rounded-md border bg-background p-2 text-sm"
                value={destination} onChange={(event) => setDestination(event.currentTarget.value)}
              >
                <option value="">移行せず削除</option>
                {destinations.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
          )}
          {state?.error ? (
            <p role="alert" className="mb-4 text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => { setOpen(false); setDestination(""); }}
              autoFocus
            >
              キャンセル
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "処理中…" : destination ? "統合する" : "削除する"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
