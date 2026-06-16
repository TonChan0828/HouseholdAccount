"use client";

import { useActionState, useState } from "react";

import type { AccountDeletionState } from "@/app/(dashboard)/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AccountDeletionAction = (
  state: AccountDeletionState,
  formData: FormData,
) => Promise<AccountDeletionState>;

type Props = {
  action: AccountDeletionAction;
  /** 確認フレーズとして要求する登録メールアドレス */
  email: string;
};

export function AccountDeletionForm({ action, email }: Props) {
  const [state, formAction, pending] = useActionState<
    AccountDeletionState,
    FormData
  >(action, undefined);
  const [confirmText, setConfirmText] = useState("");

  // 確認フレーズが登録メールと完全一致したときのみ削除を許可する（誤操作防止）。
  const canDelete = confirmText === email;

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        アカウントを削除すると元に戻せません。あなたが作成した家計簿グループは、
        他のメンバーがいる場合はオーナーを引き継ぎ、いない場合は関連データごと削除されます。
        続行するには登録メールアドレス（<span className="font-medium">{email}</span>）を入力してください。
      </p>
      <div className="space-y-2">
        <Label htmlFor="confirmText">確認のためメールアドレスを入力</Label>
        <Input
          id="confirmText"
          name="confirmText"
          type="email"
          autoComplete="off"
          placeholder={email}
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          required
        />
      </div>

      {state && "error" in state ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="destructive"
        className="w-full"
        disabled={pending || !canDelete}
      >
        {pending ? "処理中..." : "アカウントを削除する"}
      </Button>
    </form>
  );
}
