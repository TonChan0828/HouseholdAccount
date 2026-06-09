"use client";

import { useActionState } from "react";

import type { HouseholdActionState } from "@/app/households/actions";
import { Button } from "@/components/ui/button";

type AcceptAction = (
  state: HouseholdActionState,
  formData: FormData,
) => Promise<HouseholdActionState>;

export function AcceptInviteForm({
  token,
  action,
}: {
  token: string;
  action: AcceptAction;
}) {
  const [state, formAction, pending] = useActionState<
    HouseholdActionState,
    FormData
  >(action, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      {state?.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "参加中..." : "このグループに参加する"}
      </Button>
    </form>
  );
}
