import * as React from "react";

import { cn } from "@/lib/utils";

type Props = {
  /** 英字トラッキングの小見出し（任意）。 */
  eyebrow?: string;
  title: string;
  /** タイトル直下のサブ情報（期間・件数など、任意）。 */
  meta?: React.ReactNode;
  /** 右側に並べる操作（任意）。 */
  actions?: React.ReactNode;
  className?: string;
};

/** 全ページ共通の最上部見出し（eyebrow + タイトル + meta + 操作スロット）。 */
export function PageHeader({ eyebrow, title, meta, actions, className }: Props) {
  return (
    <header
      className={cn("flex flex-wrap items-end justify-between gap-3", className)}
    >
      <div className="space-y-1">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h1>
        {meta ? (
          <p className="text-sm font-medium text-muted-foreground tabular-nums">
            {meta}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
