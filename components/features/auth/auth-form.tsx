"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { AuthState } from "@/app/(auth)/actions";
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
};

export function AuthForm({
  title,
  description,
  submitLabel,
  action,
  altText,
  altHref,
  altLinkLabel,
}: AuthFormProps) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    undefined,
  );

  return (
    <Card className="w-full shadow-lifted ring-0">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
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
          <div className="space-y-2">
            <Label htmlFor="password">パスワード</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              minLength={6}
              required
            />
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
    </Card>
  );
}
