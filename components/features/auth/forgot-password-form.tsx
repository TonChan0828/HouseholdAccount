"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { PasswordResetRequestState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Action = (
  state: PasswordResetRequestState,
  formData: FormData,
) => Promise<PasswordResetRequestState>;

type Props = {
  action: Action;
};

export function ForgotPasswordForm({ action }: Props) {
  const [state, formAction, pending] = useActionState<
    PasswordResetRequestState,
    FormData
  >(action, undefined);

  return (
    <Card className="w-full shadow-lifted ring-0">
      <CardHeader>
        <CardTitle>パスワードの再設定</CardTitle>
        <CardDescription>
          登録済みのメールアドレスに再設定用リンクを送信します
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
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
              パスワード再設定用のメールを送信しました。メールをご確認ください。
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="mt-6 flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "処理中..." : "再設定メールを送信"}
          </Button>
          <p className="text-sm text-muted-foreground">
            <Link
              href="/login"
              className="text-primary underline-offset-4 hover:underline"
            >
              ログイン画面へ戻る
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
