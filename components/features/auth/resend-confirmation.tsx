"use client";

import { useActionState } from "react";

import type { ResendConfirmationState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

type Action = (
  state: ResendConfirmationState,
  formData: FormData,
) => Promise<ResendConfirmationState>;

type Props = {
  email: string;
  action: Action;
};

export function ResendConfirmation({ email, action }: Props) {
  const [state, formAction, pending] = useActionState<
    ResendConfirmationState,
    FormData
  >(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="email" value={email} />
      <Button
        type="submit"
        variant="outline"
        className="w-full"
        disabled={pending}
      >
        {pending ? "送信中..." : "確認メールを再送信"}
      </Button>
      {state && "error" in state ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      {state && "success" in state ? (
        <p className="text-sm text-primary" role="status">
          確認メールを再送信しました。メールをご確認ください。
        </p>
      ) : null}
    </form>
  );
}
