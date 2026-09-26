import { yen } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CategoryYoY } from "@/lib/yearly-analytics";

type Props = {
  income: number;
  expense: number;
  /** 前年同期の収入・支出。 */
  prevIncome: number;
  prevExpense: number;
  /** カテゴリ別の前年同期比較（|差額| 降順）。 */
  rows: CategoryYoY[];
  /** 比較対象の前年期間の表示（例:「2025年 1月〜6月」）。 */
  compareLabel: string;
};

/** 符号付きの金額差（+¥1,000 / -¥1,000）。 */
const signedYen = (n: number) => (n > 0 ? `+${yen(n)}` : yen(n));
/** 符号付きの割合（+12% / -5%）。 */
const signedPct = (ratio: number) => {
  const pct = Math.round(ratio * 100);
  return pct > 0 ? `+${pct}%` : `${pct}%`;
};

/**
 * 支出の増加は支出色、減少は収入色で示す。収入は逆（増加=良い）。
 * 「良い方向」を収入色に寄せ、色だけに頼らず符号も必ず併記する。
 */
function toneClass(diff: number, higherIsGood: boolean): string {
  if (diff === 0) return "text-muted-foreground";
  return diff > 0 === higherIsGood ? "text-income" : "text-expense";
}

function TotalRow({
  testId,
  label,
  current,
  prev,
  higherIsGood,
}: {
  testId: string;
  label: string;
  current: number;
  prev: number;
  higherIsGood: boolean;
}) {
  const diff = current - prev;
  return (
    <div
      data-testid={testId}
      className="flex flex-col gap-1 rounded-lg bg-secondary/40 p-4"
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-xs tabular-nums text-muted-foreground">
        前年 {yen(prev)} → 今年 {yen(current)}
      </span>
      <span
        className={cn(
          "flex items-baseline gap-2 font-heading text-lg font-bold tabular-nums",
          toneClass(diff, higherIsGood),
        )}
      >
        <span>{signedYen(diff)}</span>
        {prev > 0 ? (
          <span className="text-xs font-semibold">{signedPct(diff / prev)}</span>
        ) : null}
      </span>
    </div>
  );
}

/** 年間ビューの前年（同期）比較: 合計の増減とカテゴリ別の増減リスト（presentational）。 */
export function YoyComparison({
  income,
  expense,
  prevIncome,
  prevExpense,
  rows,
  compareLabel,
}: Props) {
  if (prevIncome === 0 && prevExpense === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        前年のデータがありません。
      </p>
    );
  }

  const maxDiff = Math.max(1, ...rows.map((r) => Math.abs(r.diff)));

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        比較対象: {compareLabel}（前年同期）
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <TotalRow
          testId="yoy-total-expense"
          label="支出"
          current={expense}
          prev={prevExpense}
          higherIsGood={false}
        />
        <TotalRow
          testId="yoy-total-income"
          label="収入"
          current={income}
          prev={prevIncome}
          higherIsGood
        />
      </div>

      {rows.length > 0 ? (
        <ol className="space-y-3" aria-label="カテゴリ別の前年比">
          {rows.map((r) => (
            <li key={r.categoryId ?? "none"} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 translate-y-px rounded-full"
                    style={{ backgroundColor: r.color }}
                  />
                  <span className="truncate text-sm font-medium">{r.name}</span>
                </span>
                <span
                  className={cn(
                    "flex shrink-0 items-baseline gap-2 tabular-nums",
                    toneClass(r.diff, false),
                  )}
                >
                  <span className="font-heading text-sm font-bold">
                    {signedYen(r.diff)}
                  </span>
                  <span className="w-10 text-right text-[11px] font-semibold">
                    {r.ratio === null ? "新規" : signedPct(r.ratio)}
                  </span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/60">
                <div
                  data-viz-bar
                  className={cn(
                    "h-full origin-left rounded-full",
                    r.diff > 0 ? "bg-expense" : "bg-income",
                  )}
                  style={{
                    width: `${(Math.abs(r.diff) / maxDiff) * 100}%`,
                    animation: "grow-x 0.7s cubic-bezier(0.22,1,0.36,1) both",
                  }}
                />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          カテゴリ別の増減はありません。
        </p>
      )}
    </div>
  );
}
