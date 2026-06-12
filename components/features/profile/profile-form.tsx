"use client";

import { useActionState } from "react";

import type { ProfileActionState } from "@/app/(dashboard)/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProfileAction = (
  state: ProfileActionState,
  formData: FormData,
) => Promise<ProfileActionState>;

type Props = {
  action: ProfileAction;
  defaultDisplayName: string;
};

export function ProfileForm({ action, defaultDisplayName }: Props) {
  const [state, formAction, pending] = useActionState<
    ProfileActionState,
    FormData
  >(action, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="displayName">表示名</Label>
        <Input
          id="displayName"
          name="displayName"
          maxLength={20}
          defaultValue={defaultDisplayName}
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
          表示名を更新しました
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "処理中..." : "保存する"}
      </Button>
    </form>
  );
}
