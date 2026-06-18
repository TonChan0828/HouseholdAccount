import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

/** チャートを遅延ロードしている間に表示するプレースホルダ。 */
export function ChartSkeleton({ className }: Props) {
  return (
    <div
      className={cn(
        "h-56 w-full animate-pulse rounded-md bg-muted/60",
        className,
      )}
      aria-hidden
    />
  );
}
