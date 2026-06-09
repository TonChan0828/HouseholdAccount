"use client";

import { useActionState, useState } from "react";

import type { TransactionActionState } from "@/app/(dashboard)/transactions/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Category, TransactionType } from "@/types";

type TransactionAction = (
  state: TransactionActionState,
  formData: FormData,
) => Promise<TransactionActionState>;

type Props = {
  action: TransactionAction;
  categories: Category[];
  submitLabel: string;
  defaultValues?: {
    id?: string;
    type?: TransactionType;
    amount?: number;
    date?: string;
    category_id?: string | null;
    memo?: string | null;
  };
};

function localToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function TransactionForm({
  action,
  categories,
  submitLabel,
  defaultValues,
}: Props) {
  const [state, formAction, pending] = useActionState<
    TransactionActionState,
    FormData
  >(action, undefined);

  const [type, setType] = useState<TransactionType>(
    defaultValues?.type ?? "expense",
  );

  const options = categories.filter(
    (c) => c.type === type || c.type === "both",
  );

  return (
    <form action={formAction} className="space-y-4">
      {defaultValues?.id ? (
        <input type="hidden" name="id" value={defaultValues.id} />
      ) : null}

      <fieldset className="grid grid-cols-2 gap-2">
        {(["expense", "income"] as const).map((t) => (
          <label
            key={t}
            className={cn(
              "flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm",
              type === t
                ? "border-primary bg-primary/10 font-medium"
                : "border-border",
            )}
          >
            <input
              type="radio"
              name="type"
              value={t}
              checked={type === t}
              onChange={() => setType(t)}
              className="sr-only"
            />
            {t === "expense" ? "支出" : "収入"}
          </label>
        ))}
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="amount">金額</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          min={1}
          inputMode="numeric"
          placeholder="1000"
          defaultValue={defaultValues?.amount ?? ""}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="date">日付</Label>
        <Input
          id="date"
          name="date"
          type="date"
          defaultValue={defaultValues?.date ?? localToday()}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="category_id">カテゴリ</Label>
        <select
          id="category_id"
          name="category_id"
          defaultValue={defaultValues?.category_id ?? ""}
          className="flex h-9 w-full rounded-lg border border-border bg-background px-3 py-1 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">未選択</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="memo">メモ</Label>
        <textarea
          id="memo"
          name="memo"
          rows={2}
          maxLength={200}
          defaultValue={defaultValues?.memo ?? ""}
          className="flex w-full rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      {state?.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "処理中..." : submitLabel}
      </Button>
    </form>
  );
}
