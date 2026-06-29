"use client";

import { Target, Trophy } from "lucide-react";
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

import { GoalCelebration } from "./goal-celebration";

type Props = {
  progress: SavingsProgress | null;
  goal: { start_date: string; target_date: string | null } | null;
};

/** 今日（YYYY-MM-DD）。フォームの開始日デフォルトに使う。 */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 未達時のペース/残額の補助文言（達成時は専用バッジを表示するため呼ばれない）。 */
function paceNote(p: SavingsProgress): string {
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

  // 制御入力にして、Server Action 送信後のフォーム自動リセットで入力値が
  // 消えないようにする（保存失敗時も入力を保持する）。
  const [name, setName] = useState(progress?.name ?? "");
  const [amount, setAmount] = useState(
    progress ? String(progress.targetAmount) : "",
  );
  const [startDate, setStartDate] = useState(goal?.start_date ?? todayIso());
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? "");

  useEffect(() => {
    if (state && "ok" in state && state.ok) onDone();
  }, [state, onDone]);

  return (
    <>
      {/* upsert フォーム：フィールド + エラー。保存ボタンは DialogFooter 内で form 属性で紐付け */}
      <form id="goal-upsert-form" action={formAction} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="goal-name">目標名</Label>
          <Input
            id="goal-name"
            name="name"
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
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
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
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
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-target">期日（任意）</Label>
            <Input
              id="goal-target"
              name="target_date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>
        </div>
        {state && "error" in state && (
          <p className="text-xs text-expense" role="alert">
            {state.error}
          </p>
        )}
      </form>
      {/* フッター：削除フォームと保存ボタンを兄弟として並べる（フォームの入れ子なし） */}
      <DialogFooter className="gap-2 sm:justify-between">
        {hasGoal && (
          <form action={deleteSavingsGoal}>
            <Button type="submit" variant="ghost" onClick={onDone}>
              目標を解除
            </Button>
          </form>
        )}
        <Button type="submit" form="goal-upsert-form" disabled={pending}>
          保存
        </Button>
      </DialogFooter>
    </>
  );
}

/** 貯金目標の表示＋設定ダイアログ（client）。 */
export function SavingsGoalCard({ progress, goal }: Props) {
  const [open, setOpen] = useState(false);
  const pct = progress ? Math.min(100, Math.max(0, progress.pct)) : 0;

  const reached = progress?.reached ?? false;

  return (
    <Card
      data-testid="savings-goal-card"
      className={cn(
        "relative isolate overflow-hidden shadow-soft transition-shadow",
        reached && "shadow-lifted ring-1 ring-accent-warm/40",
      )}
    >
      {reached && (
        <>
          {/* 達成時の暖色グロー */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-12 -top-16 -z-10 size-48 rounded-full bg-accent-warm/40 blur-3xl"
          />
          <GoalCelebration />
        </>
      )}
      <CardContent className="relative z-10 space-y-3">
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
                data-goal-anim
                className={cn(
                  "h-full transition-[width] duration-700 ease-out",
                  progress.reached
                    ? "bg-[linear-gradient(110deg,var(--income),var(--accent-warm),var(--income))] bg-[length:200%_100%] animate-[goal-shimmer_2.5s_linear_infinite]"
                    : "bg-income",
                )}
                style={{ width: `${pct}%` }}
                aria-hidden
              />
            </div>
            {progress.reached ? (
              <div
                data-goal-anim
                className="flex items-center gap-2 rounded-xl bg-accent-warm/15 px-3 py-2 ring-1 ring-accent-warm/30 animate-[goal-pop_400ms_cubic-bezier(0.22,1,0.36,1)_both]"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-warm/25 text-accent-warm-foreground">
                  <Trophy className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="font-heading text-sm font-bold leading-tight text-accent-warm-foreground">
                    🎉 目標達成！
                  </p>
                  <p className="text-[11px] tabular-nums text-muted-foreground">
                    {yen(progress.saved)} 貯まりました
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-[11px] tabular-nums text-muted-foreground">
                {paceNote(progress)}
              </p>
            )}
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
