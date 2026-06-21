import * as React from "react";

import { cn } from "@/lib/utils";

type Props = {
  /** 英字トラッキングの小見出し（任意）。 */
  eyebrow?: string;
  title: string;
  /** 右側に並べる操作（任意）。 */
  actions?: React.ReactNode;
  className?: string;
};

/** 全ページ共通の最上部見出し（eyebrow + タイトル + 操作スロット）。 */
export function PageHeader({ eyebrow, title, actions, className }: Props) {
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
      </div>
      {actions ? (
        <div className="flex items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
