"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type SimpleAction = (formData: FormData) => Promise<void>;

type Props = {
  householdId: string;
  householdName: string;
  /** グループの現在のメンバー数（他メンバーへの警告表示に使う）。 */
  memberCount: number;
  deleteAction: SimpleAction;
};

export function DeleteHouseholdDialog({
  householdId,
  householdName,
  memberCount,
  deleteAction,
}: Props) {
  const [open, setOpen] = useState(false);
  const otherCount = Math.max(memberCount - 1, 0);

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
      >
        グループを削除
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>グループを削除しますか？</DialogTitle>
            <DialogDescription>
              「{householdName}」とそのすべての取引・カテゴリが完全に削除されます。
              この操作は元に戻せません。
            </DialogDescription>
          </DialogHeader>

          {otherCount > 0 ? (
            <p className="text-sm font-medium text-destructive" role="alert">
              あなた以外の {otherCount} 人のメンバーのデータも削除されます。
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              キャンセル
            </Button>
            <form action={deleteAction}>
              <input type="hidden" name="household_id" value={householdId} />
              <Button type="submit" variant="destructive">
                削除する
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
