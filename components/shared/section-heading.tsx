import * as React from "react";

import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  /** 渡すと "01" のような番号を先頭に表示する。 */
  index?: number;
  className?: string;
};

/** 番号・見出し・ヘアライン罫を並べた節見出し。 */
export function SectionHeading({ children, index, className }: Props) {
  return (
    <div className={cn("mb-2 flex items-end gap-3", className)}>
      {index !== undefined ? (
        <span className="font-heading text-xs font-bold tabular-nums text-primary">
          {String(index).padStart(2, "0")}
        </span>
      ) : null}
      <h2 className="font-heading text-base font-bold">{children}</h2>
      <span className="mb-1.5 h-px flex-1 bg-border/70" aria-hidden />
    </div>
  );
}
