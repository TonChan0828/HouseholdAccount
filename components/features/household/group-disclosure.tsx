"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  /** トグルボタンに表示するラベル（例: 管理（メンバー2人））。 */
  label: string;
  children: ReactNode;
};

/**
 * グループカードの管理セクション（メンバー・招待・設定）を折り畳む開閉 UI。
 * グループ一覧の見通しを優先し、既定は閉じる。クライアント state のため
 * Server Action によるページ再描画（招待発行・保存など）では開いたまま維持される。
 */
export function GroupDisclosure({ label, children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm font-medium",
          "text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        {label}
        <ChevronDown
          aria-hidden
          className={cn("size-4 transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? <div className="mt-4 space-y-6">{children}</div> : null}
    </div>
  );
}
