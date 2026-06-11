"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const THEME_OPTIONS = [
  { value: "light", label: "ライト", icon: Sun },
  { value: "dark", label: "ダーク", icon: Moon },
  { value: "system", label: "システム", icon: Monitor },
] as const;

/** ドロップダウンメニュー内に埋め込むテーマ選択項目（ライト/ダーク/システム）。 */
export function ThemeMenuItems() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>テーマ</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={theme}
        onValueChange={(value) => setTheme(value as string)}
      >
        {/* closeOnClick: Base UI のラジオ項目は既定でメニューが閉じないため、他項目と挙動を揃える */}
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
          <DropdownMenuRadioItem key={value} value={value} closeOnClick>
            <Icon aria-hidden />
            {label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuGroup>
  );
}

/** ヘッダーのない画面（ログイン前・グループ選択）用の独立テーマ切り替えボタン。 */
export function ThemeToggleButton() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="テーマを切り替え"
        className="flex size-9 items-center justify-center rounded-full border border-border/70 bg-card text-muted-foreground shadow-soft transition-colors hover:bg-accent/60 hover:text-foreground"
      >
        {/* hydration ずれを避けるため CSS でアイコンを出し分ける */}
        <Sun className="size-4 dark:hidden" aria-hidden />
        <Moon className="hidden size-4 dark:block" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <ThemeMenuItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
