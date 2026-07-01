import * as React from "react";

import { cn } from "@/lib/utils";

type Props = {
  /** メイン列（lg で左・7/12）。 */
  main: React.ReactNode;
  /** サイドレール（lg で右・5/12）。 */
  side: React.ReactNode;
  className?: string;
};

/**
 * デスクトップ向けメイン+サイドレールの2カラムレイアウト（presentational）。
 * モバイルではラッパーを contents にして子を外側の1カラムグリッドへ直接参加させ、
 * 子側の max-lg:order-* で縦積み順を制御できるようにする。lg 以上では
 * メイン7:サイド5の独立した2列（items-start で高さ非連動）になる。
 */
export function MainSideGrid({ main, side, className }: Props) {
  return (
    <div
      data-testid="main-side-grid"
      className={cn(
        "grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start lg:gap-6",
        className,
      )}
    >
      <div className="contents min-w-0 lg:col-span-7 lg:block lg:space-y-6">
        {main}
      </div>
      <div className="contents min-w-0 lg:col-span-5 lg:block lg:space-y-6">
        {side}
      </div>
    </div>
  );
}
