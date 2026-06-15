"use client";

import Link from "next/link";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Household = { id: string; name: string };

type Props = {
  /** ログイン中ユーザーが所属する全グループ（joined_at 昇順） */
  households: Household[];
  /** 現在アクティブなグループ ID */
  activeId: string;
  /** アクティブグループを切り替える Server Action */
  switchAction: (formData: FormData) => Promise<void>;
};

/**
 * ヘッダー常設のグループ・スイッチャー。
 * 現在のグループ名をトリガーに表示し、開くと所属グループ一覧から
 * ワンクリックで切り替えられる。切替後は今いるページがそのまま更新される。
 */
export function HouseholdSwitcher({ households, activeId, switchAction }: Props) {
  const activeName =
    households.find((h) => h.id === activeId)?.name ?? "家計簿グループ";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex w-36 items-center gap-1.5 rounded-full border border-border/70 bg-card py-1 pl-3 pr-2 text-sm shadow-soft transition-colors hover:bg-accent/60 sm:w-44"
        aria-label={`グループを切り替え（現在: ${activeName}）`}
      >
        <span className="min-w-0 flex-1 truncate text-left font-heading font-semibold">
          {activeName}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        style={{ width: "16rem", maxWidth: "calc(100vw - 1.5rem)" }}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>グループを切り替え</DropdownMenuLabel>
        </DropdownMenuGroup>
        {households.map((h) => {
          const isActive = h.id === activeId;
          return (
            <DropdownMenuItem
              key={h.id}
              className="min-w-0"
              aria-current={isActive ? "true" : undefined}
              onClick={
                isActive
                  ? undefined
                  : () => {
                      const formData = new FormData();
                      formData.set("household_id", h.id);
                      void switchAction(formData);
                    }
              }
            >
              {isActive ? (
                <Check className="shrink-0" aria-hidden />
              ) : (
                <span className="size-4 shrink-0" aria-hidden />
              )}
              <span className="min-w-0 truncate">{h.name}</span>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/households" />}>
          <Plus aria-hidden />
          グループを管理・追加
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
