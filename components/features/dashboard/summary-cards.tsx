import {
  ArrowDownRight,
  ArrowUpRight,
  PiggyBank,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { BudgetProgressBar } from "@/components/features/budgets/budget-progress-bar";
import { yen } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  income: number;
  expense: number;
  /** 前期の収入計。渡すと前期比を表示する。 */
  prevIncome?: number;
  /** 前期の支出計。渡すと前期比を表示する。 */
  prevExpense?: number;
  /** 予算設定済みカテゴリの予算合計。>0 のとき予算進捗バーを表示する。 */
  budgetTotal?: number;
  /** 予算設定済みカテゴリの当期実績合計（世帯全体）。 */
  budgetSpent?: number;
};

function diffLabel(current: number, prev: number | undefined): string | null {
  if (prev === undefined) return null;
  const diff = current - prev;
  return `前期比 ${diff >= 0 ? "+" : ""}${yen(diff)}`;
}

/** 前期比のチップ。改善方向（収入↑/支出↓）を色で示す。 */
function DiffChip({
  label,
  positive,
}: {
  label: string | null;
  positive: boolean;
}) {
  if (!label) return null;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
        positive
          ? "bg-income-soft text-income"
          : "bg-expense-soft text-expense",
      )}
    >
      <Icon className="size-3" aria-hidden />
      {label}
    </span>
  );
}

/**
 * 貯蓄率を表す軽量な SVG ドーナツリング。
 * income > 0 のとき balance/income を 0〜100% にクランプして描画する。
 */
function SavingsRing({
  income,
  balance,
}: {
  income: number;
  balance: number;
}) {
  const rate = income > 0 ? Math.max(0, Math.min(1, balance / income)) : 0;
  const pct = Math.round(rate * 100);
  const positive = balance >= 0;
  const r = 38;
  const circ = 2 * Math.PI * r;
  const stroke = positive ? "var(--income)" : "var(--expense)";

  return (
    <div className="relative flex size-24 shrink-0 items-center justify-center">
      <svg viewBox="0 0 96 96" className="size-24 -rotate-90">
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          strokeWidth="9"
          className="stroke-secondary"
        />
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          style={{
            stroke,
            strokeDasharray: circ,
            strokeDashoffset: circ * (1 - rate),
            transition: "stroke-dashoffset 700ms cubic-bezier(0.22,1,0.36,1)",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn(
            "font-heading text-xl font-bold tabular-nums leading-none",
            positive ? "text-income" : "text-expense",
          )}
        >
          {pct}%
        </span>
        <span className="mt-0.5 text-[10px] font-medium text-muted-foreground">
          貯蓄率
        </span>
      </div>
    </div>
  );
}

/** 凡例ドット。 */
function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("size-2 rounded-full", className)} aria-hidden />
      {label}
    </span>
  );
}

/**
 * 支出が収入に占める割合（支出 ÷ 収入）を示す消費バー。
 * 収入を 100% のトラックとし、左から赤＝支出、残り緑＝貯蓄余力（= 貯蓄率）として描く。
 * 支出が収入を超過した場合は全面赤＋超過額、どちらも 0 のときは空トラックを表示する。
 */
function ConsumptionBar({
  income,
  expense,
}: {
  income: number;
  expense: number;
}) {
  const empty = income === 0 && expense === 0;
  const overspent = expense > income;
  // 収入が 0 で支出があるときも超過扱い。
  const spentPct =
    income > 0 ? Math.min(100, Math.round((expense / income) * 100)) : 0;
  const redWidth = overspent ? 100 : spentPct;
  const greenWidth = overspent ? 0 : 100 - redWidth;

  const label = empty
    ? "収入・支出の記録なし"
    : overspent
      ? `支出が収入を超過（+${yen(expense - income)}）`
      : `支出は収入の${spentPct}%`;

  const ariaLabel =
    empty || overspent
      ? label
      : `支出は収入の${spentPct}%。残り${100 - spentPct}%が貯蓄。`;

  return (
    <div className="space-y-1.5">
      <div
        role="img"
        aria-label={ariaLabel}
        className="flex h-2 w-full overflow-hidden rounded-full bg-secondary"
      >
        <div
          className="h-full bg-income transition-[width] duration-700 ease-out"
          style={{ width: `${greenWidth}%` }}
          aria-hidden
        />
        <div
          className="h-full bg-expense transition-[width] duration-700 ease-out"
          style={{ width: `${redWidth}%` }}
          aria-hidden
        />
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="tabular-nums">{label}</span>
        {!empty && (
          <span className="flex items-center gap-3">
            <LegendDot className="bg-income" label="貯蓄" />
            <LegendDot className="bg-expense" label="支出" />
          </span>
        )}
      </div>
    </div>
  );
}

/** 収入・支出の補助タイル。 */
function StatTile({
  label,
  value,
  diff,
  positive,
  icon: Icon,
  tone,
  iconBg,
}: {
  label: string;
  value: string;
  diff: string | null;
  positive: boolean;
  icon: typeof TrendingUp;
  tone: string;
  iconBg: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl bg-secondary/40 p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full",
            iconBg,
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
      </div>
      <p
        className={cn(
          "font-heading text-lg font-bold tabular-nums sm:text-xl",
          tone,
        )}
      >
        {value}
      </p>
      <DiffChip label={diff} positive={positive} />
    </div>
  );
}

/**
 * 当期の収支を 1 枚のヒーローにまとめて表示する（presentational）。
 * 中央に収支差と貯蓄率リング、その下に収入/支出の比率帯とタイルを並べる。
 */
export function SummaryCards({
  income,
  expense,
  prevIncome,
  prevExpense,
  budgetTotal,
  budgetSpent,
}: Props) {
  const balance = income - expense;
  const balancePositive = balance >= 0;
  const balanceDiff =
    prevIncome !== undefined && prevExpense !== undefined
      ? diffLabel(balance, prevIncome - prevExpense)
      : null;

  return (
    <Card
      data-testid="summary-cards"
      className="relative isolate overflow-hidden shadow-soft ring-0"
    >
      {/* テーマ色の淡い光彩で平板さをなくす装飾 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 -z-10 size-56 rounded-full bg-accent/50 blur-3xl"
      />
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full",
                  balancePositive
                    ? "bg-income-soft text-income"
                    : "bg-expense-soft text-expense",
                )}
              >
                <PiggyBank className="size-4" aria-hidden />
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                収支
              </span>
            </div>
            <p
              className={cn(
                "font-heading text-3xl font-bold tabular-nums sm:text-4xl",
                balancePositive ? "text-income" : "text-expense",
              )}
            >
              {yen(balance)}
            </p>
            <DiffChip label={balanceDiff} positive={balancePositive} />
          </div>
          <SavingsRing income={income} balance={balance} />
        </div>

        <ConsumptionBar income={income} expense={expense} />

        {budgetTotal !== undefined && budgetTotal > 0 && (
          <div className="space-y-1.5 border-t border-border/60 pt-3">
            <span className="text-[11px] font-medium text-muted-foreground">
              予算（世帯全体）
            </span>
            <BudgetProgressBar
              spent={budgetSpent ?? 0}
              budget={budgetTotal}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <StatTile
            label="収入"
            value={yen(income)}
            diff={diffLabel(income, prevIncome)}
            positive={income - (prevIncome ?? income) >= 0}
            icon={TrendingUp}
            tone="text-income"
            iconBg="bg-income-soft text-income"
          />
          <StatTile
            label="支出"
            value={yen(expense)}
            diff={diffLabel(expense, prevExpense)}
            positive={expense - (prevExpense ?? expense) <= 0}
            icon={TrendingDown}
            tone="text-expense"
            iconBg="bg-expense-soft text-expense"
          />
        </div>
      </CardContent>
    </Card>
  );
}
