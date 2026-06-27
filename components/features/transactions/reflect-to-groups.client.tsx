"use client";

import { useActionState, useState } from "react";

import type { ReflectActionState } from "@/app/(dashboard)/transactions/actions";
import { reflectTransaction } from "@/app/(dashboard)/transactions/actions";
import { Button } from "@/components/ui/button";

type Props = {
  transactionId: string;
  /** 反映先候補（反映元を除く自分の所属グループ）。 */
  otherHouseholds: { id: string; name: string }[];
};

/** 既存の収支を他グループへ後追いで反映するフォーム。 */
export function ReflectToGroups({ transactionId, otherHouseholds }: Props) {
  const [state, formAction, pending] = useActionState<
    ReflectActionState,
    FormData
  >(reflectTransaction, undefined);
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  return (
    <form action={formAction} className="border-t pt-4">
      <input type="hidden" name="id" value={transactionId} />
      {selected.map((id) => (
        <input key={id} type="hidden" name="reflect_household_ids" value={id} />
      ))}

      <p className="text-sm font-medium">他のグループへ反映</p>
      <p className="mt-1 text-xs text-muted-foreground">
        この収支を選択したグループにもコピーします。カテゴリは同名のものに紐付け、無ければ未分類になります。
      </p>

      <div className="mt-3 flex flex-col gap-2">
        {otherHouseholds.map((h) => (
          <label
            key={h.id}
            className="flex cursor-pointer items-center gap-2 text-sm"
          >
            <input
              type="checkbox"
              checked={selected.includes(h.id)}
              onChange={() => toggle(h.id)}
              className="size-4 rounded border-border accent-primary"
            />
            {h.name}
          </label>
        ))}
      </div>

      {state && "error" in state ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      {state && "ok" in state ? (
        <p className="mt-2 text-sm text-income" role="status" aria-live="polite">
          {state.count}件のグループに反映しました
        </p>
      ) : null}

      <Button
        type="submit"
        variant="outline"
        className="mt-3 w-full"
        disabled={pending || selected.length === 0}
      >
        {pending ? "反映中..." : "選択したグループへ反映"}
      </Button>
    </form>
  );
}
