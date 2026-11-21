import type { PeriodSummary } from "@/lib/analytics";
import { yen } from "@/lib/format";

type Props = {
  data: PeriodSummary[];
};

/**
 * 直近各期の収入・支出をペア棒で並べたカスタム CSS チャート（presentational）。
 * Recharts を使わず最大値スケールで描画し、各棒を段階的にグローさせる。
 * 金額は title 属性のみで提示する（テキストノード化せず getByText と衝突させない）。
 */
export function TrendBars({ data }: Props) {
  const values = data.flatMap(({ income, expense }) => [income, expense]);
  const aboveZero = Math.max(0, ...values);
  const belowZero = Math.abs(Math.min(0, ...values));
  const span = Math.max(1, aboveZero + belowZero);
  const zeroFromTop = belowZero > 0 ? (aboveZero / span) * 100 : 100;

  const barStyle = (amount: number, delay: number) => ({
    height: `${(Math.abs(amount) / span) * 100}%`,
    ...(amount < 0 ? { top: `${zeroFromTop}%` } : { bottom: `${100 - zeroFromTop}%` }),
    transformOrigin: amount < 0 ? "top" : "bottom",
    animation: "rise-y 0.7s cubic-bezier(0.22,1,0.36,1) both",
    animationDelay: `${delay}ms`,
  });

  return (
    <div className="space-y-3">
      <div className="flex h-48 items-end gap-2 sm:gap-4">
        {data.map((d, i) => (
          <div
            key={d.label}
            className="flex h-full flex-1 flex-col justify-end gap-1.5"
          >
            <div className="relative flex flex-1 justify-center gap-1">
              {belowZero > 0 && (
                <div aria-hidden className="absolute inset-x-0 border-t border-border"
                  style={{ top: `${zeroFromTop}%` }} />
              )}
              <div className="relative w-1/2 max-w-2.5">
                <div data-viz-bar title={`収入 ${yen(d.income)}`}
                  className="absolute inset-x-0 rounded-sm bg-income transition-opacity hover:opacity-80"
                  style={barStyle(d.income, i * 70)} />
              </div>
              <div className="relative w-1/2 max-w-2.5">
                <div data-viz-bar title={`支出 ${yen(d.expense)}`}
                  className="absolute inset-x-0 rounded-sm bg-expense transition-opacity hover:opacity-80"
                  style={barStyle(d.expense, i * 70 + 90)} />
              </div>
            </div>
            <span className="text-center text-[10px] text-muted-foreground tabular-nums">
              {d.label}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-5 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-income" aria-hidden />
          収入
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-expense" aria-hidden />
          支出
        </span>
      </div>
    </div>
  );
}
