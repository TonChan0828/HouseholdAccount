"use client";

import { useActionState, useRef, useState } from "react";
import { unstable_rethrow } from "next/navigation";

import type { CategoryActionState } from "@/app/(dashboard)/categories/actions";
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
};

const GENERIC_ERROR = "カテゴリの削除に失敗しました。時間をおいて再度お試しください。";

/**
 * 確認ダイアログを経てカテゴリを削除するボタン。
 * 成功時は action が redirect する。失敗はダイアログ内に表示し、成功に見せない。
 */
export function DeleteCategoryButton({ action, categoryId, categoryName }: Props) {
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
        if (!submitting.current) setOpen(nextOpen);
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
            「{categoryName}」を削除します。このカテゴリを使用している収支は「未選択」に変更されます。
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
