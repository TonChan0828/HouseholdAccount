"use client";

import { useActionState, useState } from "react";

import {
  createSettlement,
  deleteSettlement,
  type SettlementActionState,
} from "@/app/(dashboard)/settlements/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** 「精算済みにする」ボタン。確認ダイアログを挟んで createSettlement を実行する。 */
export function SettleButton({ refParam }: { refParam: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<
    SettlementActionState,
    FormData
  >(createSettlement, undefined);

  return (
    <div className="space-y-2">
      <Button
        type="button"
        className="h-11 w-full text-base shadow-soft"
        onClick={() => setOpen(true)}
      >
        精算済みにする
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>この期間を精算済みにしますか？</DialogTitle>
            <DialogDescription>
              現在の計算結果を記録します。以後この期間は精算済みとして表示されます。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              キャンセル
            </Button>
            <form action={formAction}>
              <input type="hidden" name="ref" value={refParam} />
              <Button type="submit" disabled={pending}>
                {pending ? "処理中..." : "精算を確定する"}
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {state && "error" in state ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}

/** 精算の取り消し（実行者本人にのみ表示される想定）。二段階の確認を挟む。 */
export function CancelSettlementButton({
  settlementId,
}: {
  settlementId: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => setConfirming(true)}
      >
        取り消す
      </Button>
    );
  }

  return (
    <form action={deleteSettlement} className="flex items-center gap-2">
      <input type="hidden" name="id" value={settlementId} />
      <Button type="submit" variant="destructive">
        精算を取り消す
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => setConfirming(false)}
      >
        キャンセル
      </Button>
    </form>
  );
}
