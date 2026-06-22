"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { AuthState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Surface } from "@/components/shared/surface";

type AuthAction = (
  state: AuthState,
  formData: FormData,
) => Promise<AuthState>;

type AuthFormProps = {
  title: string;
  description: string;
  submitLabel: string;
  action: AuthAction;
  altText: string;
  altHref: string;
  altLinkLabel: string;
  forgotPasswordHref?: string;
  /** 指定するとパスワード欄の下に要件を補足表示し、最小文字数を 8 に引き上げる */
  passwordHint?: string;
  /** 指定するとフォーム上部に通知メッセージ（role="status"）を表示する */
  notice?: string;
};

export function AuthForm({
  title,
  description,
  submitLabel,
  action,
  altText,
  altHref,
  altLinkLabel,
  forgotPasswordHref,
  passwordHint,
  notice,
}: AuthFormProps) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    undefined,
  );

  return (
    <Surface variant="raised" className="w-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="space-y-4">
          {notice ? (
            <p className="text-sm text-primary" role="status">
              {notice}
            </p>
          ) : null}
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
          <div className="space-y-2">
            <Label htmlFor="password">パスワード</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={passwordHint ? "new-password" : "current-password"}
              minLength={passwordHint ? 8 : 6}
              aria-describedby={passwordHint ? "password-hint" : undefined}
              required
            />
            {passwordHint ? (
              <p id="password-hint" className="text-sm text-muted-foreground">
                {passwordHint}
              </p>
            ) : null}
            {forgotPasswordHref ? (
              <p className="text-right text-sm">
                <Link
                  href={forgotPasswordHref}
                  className="text-muted-foreground underline-offset-4 hover:underline"
                >
                  パスワードをお忘れですか？
                </Link>
              </p>
            ) : null}
          </div>
          {state?.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="mt-6 flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "処理中..." : submitLabel}
          </Button>
          <p className="text-sm text-muted-foreground">
            {altText}{" "}
            <Link
              href={altHref}
              className="text-primary underline-offset-4 hover:underline"
            >
              {altLinkLabel}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Surface>
  );
}
