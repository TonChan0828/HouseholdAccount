"use client";

import { useActionState } from "react";

import type { HouseholdActionState } from "@/app/households/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type HouseholdAction = (
  state: HouseholdActionState,
  formData: FormData,
) => Promise<HouseholdActionState>;

export function CreateHouseholdForm({ action }: { action: HouseholdAction }) {
  const [state, formAction, pending] = useActionState<
    HouseholdActionState,
    FormData
  >(action, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="household-name">グループ名</Label>
        <Input
          id="household-name"
          name="name"
          placeholder="我が家"
          maxLength={100}
          required
        />
      </div>
      {state?.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "作成中..." : "グループを作成"}
      </Button>
    </form>
  );
}
