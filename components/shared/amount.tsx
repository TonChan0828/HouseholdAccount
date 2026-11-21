import { yen } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  value: number;
  /** 通常の収支の符号と色を決める。負額は調整額の符号を表示する。 */
  type: "income" | "expense";
  /** 既定 true。先頭に +/- を付ける。 */
  showSign?: boolean;
  className?: string;
};

/** 収支金額を符号・色・等幅で一元表示する。 */
export function Amount({ value, type, showSign = true, className }: Props) {
  const sign = showSign && value >= 0 ? (type === "income" ? "+" : "-") : "";
  return (
    <span
      className={cn(
        "font-heading font-bold tabular-nums",
        type === "income" ? "text-income" : "text-expense",
        className,
      )}
    >
      {value < 0 && (
        <span className="mr-1 text-xs font-medium text-muted-foreground">調整</span>
      )}
      {sign}{yen(value)}
    </span>
  );
}
