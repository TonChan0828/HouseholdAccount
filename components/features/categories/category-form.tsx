"use client";

import { useActionState } from "react";

import type { CategoryActionState } from "@/app/(dashboard)/categories/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORY_COLORS } from "@/lib/validations/category";
import { cn } from "@/lib/utils";
import type { CategoryType } from "@/types";

type CategoryAction = (
  state: CategoryActionState,
  formData: FormData,
) => Promise<CategoryActionState>;

type Props = {
  action: CategoryAction;
  submitLabel: string;
  defaultValues?: {
    id?: string;
    name?: string;
    color?: string | null;
    type?: CategoryType;
  };
};

const TYPE_OPTIONS: { value: CategoryType; label: string }[] = [
  { value: "expense", label: "支出" },
  { value: "income", label: "収入" },
  { value: "both", label: "両方" },
];

export function CategoryForm({ action, submitLabel, defaultValues }: Props) {
  const [state, formAction, pending] = useActionState<
    CategoryActionState,
    FormData
  >(action, undefined);

  return (
    <form action={formAction} className="space-y-4">
      {defaultValues?.id ? (
        <input type="hidden" name="id" value={defaultValues.id} />
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="name">カテゴリ名</Label>
        <Input
          id="name"
          name="name"
          maxLength={50}
          placeholder="ペット"
          defaultValue={defaultValues?.name ?? ""}
          required
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">色</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((color, i) => (
            <label key={color} className="cursor-pointer">
              <input
                type="radio"
                name="color"
                value={color}
                aria-label={`色: ${color}`}
                defaultChecked={
                  defaultValues?.color ? defaultValues.color === color : i === 0
                }
                className="peer sr-only"
              />
              <span
                className="block size-7 rounded-full border-2 border-transparent peer-checked:border-foreground"
                style={{ backgroundColor: color }}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">種別</legend>
        <div className="grid grid-cols-3 gap-2">
          {TYPE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={cn(
                "flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-sm",
                "has-checked:border-primary has-checked:bg-primary/10 has-checked:font-medium",
              )}
            >
              <input
                type="radio"
                name="type"
                value={opt.value}
                defaultChecked={
                  (defaultValues?.type ?? "expense") === opt.value
                }
                className="sr-only"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </fieldset>

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
