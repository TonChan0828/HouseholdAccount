"use client";

import { useActionState } from "react";

import {
  deleteBudget,
  upsertBudget,
  type BudgetActionState,
} from "@/app/(dashboard)/budgets/actions";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Surface } from "@/components/shared/surface";
import type { BudgetRow } from "@/lib/budget";
import { yen } from "@/lib/format";

import { BudgetProgressBar } from "./budget-progress-bar";

/** 1カテゴリの予実表示＋予算の設定/解除フォーム（client）。 */
export function BudgetRowCard({ row }: { row: BudgetRow }) {
  const [state, formAction, pending] = useActionState<
    BudgetActionState,
    FormData
  >(upsertBudget, undefined);
  const hasBudget = row.budget > 0;

  return (
    <Surface variant="raised" data-testid="budget-row">
      <CardContent className="space-y-3 py-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="inline-block size-8 shrink-0 rounded-xl shadow-soft"
            style={{ backgroundColor: row.color }}
          />
          <span className="truncate text-sm font-medium">{row.name}</span>
        </div>

        {hasBudget ? (
          <BudgetProgressBar spent={row.spent} budget={row.budget} />
        ) : (
          <p className="text-[11px] text-muted-foreground tabular-nums">
            予算未設定（当期支出 {yen(row.spent)}）
          </p>
        )}

        <div className="flex items-center gap-2">
          <form action={formAction} className="flex flex-1 items-center gap-2">
            <input type="hidden" name="category_id" value={row.categoryId} />
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                ¥
              </span>
              <Input
                name="amount"
                inputMode="numeric"
                autoComplete="off"
                aria-label={`${row.name}の予算額`}
                defaultValue={hasBudget ? String(row.budget) : ""}
                placeholder="予算額"
                className="pl-7"
              />
            </div>
            <Button type="submit" size="sm" disabled={pending}>
              保存
            </Button>
          </form>
          {hasBudget && (
            <form action={deleteBudget}>
              <input type="hidden" name="category_id" value={row.categoryId} />
              <Button type="submit" variant="ghost" size="sm">
                解除
              </Button>
            </form>
          )}
        </div>

        {state?.error && (
          <p className="text-xs text-expense" role="alert">
            {state.error}
          </p>
        )}
      </CardContent>
    </Surface>
  );
}
