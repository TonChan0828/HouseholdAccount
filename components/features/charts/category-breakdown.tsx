import type { CategorySlice } from "@/lib/analytics";
import { yen } from "@/lib/format";

type Props = {
  data: CategorySlice[];
  /** 支出が無いときの案内文。 */
  emptyMessage?: string;
};

/**
 * カテゴリ別支出を「コニックグラデのドーナツ + ランキング型リーグテーブル」で表示する。
 * Recharts を使わず CSS/SVG のみで描画する（presentational / server component 可）。
 *
 * 注: カテゴリ名と yen(amount) は画面内で一意になるよう、ここでのみ描画する
 * （E2E の getByText は部分一致・厳格モードのため重複させない）。
 */
export function CategoryBreakdown({
  data,
  emptyMessage = "当期の支出はまだありません。",
}: Props) {
  if (data.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  const showProportions = data.every((item) => item.amount >= 0) &&
    data.some((item) => item.amount > 0);
  const total = data.reduce((sum, item) => sum + item.amount, 0);
  const max = data[0].amount;
  const topShare = showProportions ? Math.round((max / total) * 100) : 0;

  let cumulative = 0;
  const stops = showProportions ? data.map(({ amount, color }) => {
    const start = (cumulative / total) * 100;
    cumulative += amount;
    return `${color} ${start}% ${(cumulative / total) * 100}%`;
  }) : [];
  const gradient = `conic-gradient(from -90deg, ${stops.join(", ")})`;

  return (
    <div className="flex flex-col gap-7 sm:flex-row sm:items-center">
      {/* ドーナツ */}
      {showProportions && (
        <div className="relative mx-auto size-44 shrink-0 sm:mx-0">
          <div
            className="size-full rounded-full shadow-soft"
            style={{ background: gradient }}
            aria-hidden
          />
          <div className="absolute inset-[19%] flex flex-col items-center justify-center rounded-full bg-card text-center ring-1 ring-foreground/5">
            <span className="font-heading text-3xl font-bold leading-none tabular-nums">
              {topShare}
              <span className="text-lg">%</span>
            </span>
            <span className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              最多カテゴリ
            </span>
          </div>
        </div>

      )}


      {/* リーグテーブル */}
      <ol className="min-w-0 flex-1 space-y-3">
        {data.map((d, i) => {
          const share = showProportions ? Math.round((d.amount / total) * 100) : 0;
          const width = showProportions ? (d.amount / max) * 100 : 0;
          return (
            <li key={d.categoryId ?? "none"} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="w-5 shrink-0 font-heading text-xs font-bold tabular-nums text-muted-foreground/60">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 translate-y-px rounded-full"
                    style={{ backgroundColor: d.color }}
                  />
                  <span className="truncate text-sm font-medium">{d.name}</span>
                </span>
                <span className="flex shrink-0 items-baseline gap-2.5">
                  <span className="font-heading text-sm font-bold tabular-nums">
                    {yen(d.amount)}
                  </span>
                  <span className="text-xs tabular-nums">{d.count}件</span>
                  {showProportions && <span className="w-9 text-right text-[11px] tabular-nums text-muted-foreground">
                    {share}%
                  </span>}
                </span>
              </div>
              {showProportions && <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/60">
                <div
                  data-viz-bar
                  className="h-full origin-left rounded-full"
                  style={{
                    width: `${width}%`,
                    backgroundColor: d.color,
                    animation: "grow-x 0.7s cubic-bezier(0.22,1,0.36,1) both",
                    animationDelay: `${150 + Math.min(i, 10) * 70}ms`,
                  }}
                />
              </div>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
