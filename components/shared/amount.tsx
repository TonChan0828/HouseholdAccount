import { yen } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  value: number;
  /** 金額の絶対値で表示する（符号は type で決まる）。 */
  type: "income" | "expense";
  /** 既定 true。先頭に +/- を付ける。 */
  showSign?: boolean;
  className?: string;
};

/** 収支金額を符号・色・等幅で一元表示する。 */
export function Amount({ value, type, showSign = true, className }: Props) {
  const sign = showSign ? (type === "income" ? "+" : "-") : "";
  return (
    <span
      className={cn(
        "font-heading font-bold tabular-nums",
        type === "income" ? "text-income" : "text-expense",
        className,
      )}
    >
      {sign}
      {yen(Math.abs(value))}
    </span>
  );
}
