"use client";

import { Target } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

import {
  deleteSavingsGoal,
  upsertSavingsGoal,
  type SavingsGoalActionState,
} from "@/app/(dashboard)/dashboard/savings-goal-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { yen } from "@/lib/format";
import type { SavingsProgress } from "@/lib/savings-goal";
import { cn } from "@/lib/utils";

type Props = {
  progress: SavingsProgress | null;
  goal: { start_date: string; target_date: string | null } | null;
};

/** 今日（YYYY-MM-DD）。フォームの開始日デフォルトに使う。 */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 進捗に応じたペース/残額の補助文言。 */
function paceNote(p: SavingsProgress): string {
  if (p.reached) return "達成 🎉";
  if (p.pace?.overdue) return `期日超過（あと${yen(p.remaining)}）`;
  if (p.pace) {
    return `期日まであと${p.pace.monthsLeft}ヶ月・月${yen(p.pace.requiredPerMonth)}ペース`;
  }
  return `残り ${yen(p.remaining)}`;
}

/** 設定/編集フォーム（ダイアログ本体）。 */
function GoalForm({
  progress,
  goal,
  onDone,
  hasGoal,
}: Props & { onDone: () => void; hasGoal: boolean }) {
  const [state, formAction, pending] = useActionState<
    SavingsGoalActionState,
    FormData
  >(upsertSavingsGoal, undefined);

  useEffect(() => {
    if (state && "ok" in state && state.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="goal-name">目標名</Label>
        <Input
          id="goal-name"
          name="name"
          autoComplete="off"
          defaultValue={progress?.name ?? ""}
          placeholder="例: 旅行資金"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="goal-amount">目標額</Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            ¥
          </span>
          <Input
            id="goal-amount"
            name="target_amount"
            inputMode="numeric"
            autoComplete="off"
            defaultValue={progress ? String(progress.targetAmount) : ""}
            placeholder="目標額"
            className="pl-7"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="goal-start">開始日</Label>
          <Input
            id="goal-start"
            name="start_date"
            type="date"
            defaultValue={goal?.start_date ?? todayIso()}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="goal-target">期日（任意）</Label>
          <Input
            id="goal-target"
            name="target_date"
            type="date"
            defaultValue={goal?.target_date ?? ""}
          />
        </div>
      </div>
      {state && "error" in state && (
        <p className="text-xs text-expense" role="alert">
          {state.error}
        </p>
      )}
      <DialogFooter className="gap-2 sm:justify-between">
        {hasGoal && (
          <form action={deleteSavingsGoal}>
            <Button type="submit" variant="ghost" onClick={onDone}>
              目標を解除
            </Button>
          </form>
        )}
        <Button type="submit" disabled={pending}>
          保存
        </Button>
      </DialogFooter>
    </form>
  );
}

/** 貯金目標の表示＋設定ダイアログ（client）。 */
export function SavingsGoalCard({ progress, goal }: Props) {
  const [open, setOpen] = useState(false);
  const pct = progress ? Math.min(100, Math.max(0, progress.pct)) : 0;

  return (
    <Card data-testid="savings-goal-card" className="shadow-soft">
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-income-soft text-income">
              <Target className="size-4" aria-hidden />
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              貯金目標
            </span>
          </div>
          <Button
            variant={progress ? "ghost" : "default"}
            size="sm"
            onClick={() => setOpen(true)}
          >
            {progress ? "編集" : "目標を設定"}
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>貯金目標</DialogTitle>
                <DialogDescription>
                  開始日以降の収支差額を貯金として進捗を表示します。
                </DialogDescription>
              </DialogHeader>
              <GoalForm
                progress={progress}
                goal={goal}
                onDone={() => setOpen(false)}
                hasGoal={progress !== null}
              />
            </DialogContent>
          </Dialog>
        </div>

        {progress ? (
          <>
            <p className="truncate font-heading text-base font-bold">
              {progress.name}
            </p>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
              <span>
                {yen(progress.saved)}{" "}
                <span className="opacity-60">/ {yen(progress.targetAmount)}</span>
              </span>
              <span
                className={cn("font-medium", progress.reached && "text-income")}
              >
                {progress.pct}%
              </span>
            </div>
            <div
              role="img"
              aria-label={`目標 ${yen(progress.targetAmount)} に対し ${yen(progress.saved)}（${progress.pct}%）`}
              className="h-2 w-full overflow-hidden rounded-full bg-secondary"
            >
              <div
                className="h-full bg-income transition-[width] duration-700 ease-out"
                style={{ width: `${pct}%` }}
                aria-hidden
              />
            </div>
            <p
              className={cn(
                "text-[11px] tabular-nums",
                progress.reached ? "font-medium text-income" : "text-muted-foreground",
              )}
            >
              {paceNote(progress)}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            貯金目標はまだありません。目標額を決めて、みんなで貯めましょう。
          </p>
        )}
      </CardContent>
    </Card>
  );
}
