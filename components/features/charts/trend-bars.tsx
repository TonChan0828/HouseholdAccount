import type { PeriodSummary } from "@/lib/analytics";

type Props = {
  data: PeriodSummary[];
};

const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

/**
 * 直近各期の収入・支出をペア棒で並べたカスタム CSS チャート（presentational）。
 * Recharts を使わず最大値スケールで描画し、各棒を段階的にグローさせる。
 * 金額は title 属性のみで提示する（テキストノード化せず getByText と衝突させない）。
 */
export function TrendBars({ data }: Props) {
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));

  return (
    <div className="space-y-3">
      <div className="flex h-48 items-end gap-2 sm:gap-4">
        {data.map((d, i) => (
          <div
            key={d.label}
            className="flex h-full flex-1 flex-col justify-end gap-1.5"
          >
            <div className="flex flex-1 items-end justify-center gap-1">
              <div
                data-viz-bar
                title={`収入 ${yen(d.income)}`}
                className="w-1/2 max-w-2.5 origin-bottom rounded-t-[3px] bg-income transition-opacity hover:opacity-80"
                style={{
                  height: `${(d.income / max) * 100}%`,
                  animation: "rise-y 0.7s cubic-bezier(0.22,1,0.36,1) both",
                  animationDelay: `${i * 70}ms`,
                }}
              />
              <div
                data-viz-bar
                title={`支出 ${yen(d.expense)}`}
                className="w-1/2 max-w-2.5 origin-bottom rounded-t-[3px] bg-expense transition-opacity hover:opacity-80"
                style={{
                  height: `${(d.expense / max) * 100}%`,
                  animation: "rise-y 0.7s cubic-bezier(0.22,1,0.36,1) both",
                  animationDelay: `${i * 70 + 90}ms`,
                }}
              />
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
