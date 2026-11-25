"use client";

import { useActionState } from "react";

import { deleteTransactionWithUndo } from "@/app/(dashboard)/transactions/actions";
import { Button } from "@/components/ui/button";

export function DeleteTransactionForm({ id, householdId }: { id: string; householdId: string }) {
  const [state, formAction, pending] = useActionState(deleteTransactionWithUndo, undefined);

  return (
    <form action={formAction} className="space-y-2 border-t pt-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="householdId" value={householdId} />
      {state ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" variant="destructive" className="w-full" disabled={pending}>
        {pending ? "削除中…" : "この収支を削除"}
      </Button>
    </form>
  );
}
