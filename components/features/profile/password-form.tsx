"use client";

import { useActionState } from "react";

import type { PasswordActionState } from "@/app/(dashboard)/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_POLICY_HINT } from "@/lib/validations/auth";

type PasswordAction = (
  state: PasswordActionState,
  formData: FormData,
) => Promise<PasswordActionState>;

type Props = {
  action: PasswordAction;
};

export function PasswordForm({ action }: Props) {
  const [state, formAction, pending] = useActionState<
    PasswordActionState,
    FormData
  >(action, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">新しいパスワード</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          aria-describedby="password-hint"
          required
        />
        <p id="password-hint" className="text-sm text-muted-foreground">
          {PASSWORD_POLICY_HINT}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">新しいパスワード（確認）</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>

      {state && "error" in state ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      {state && "success" in state ? (
        <p className="text-sm text-primary" role="status">
          パスワードを変更しました
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "処理中..." : "変更する"}
      </Button>
    </form>
  );
}
