import {
  ChartPie,
  House,
  ReceiptJapaneseYen,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** ヘッダー（デスクトップ）に表示する主要ナビ。 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "ホーム", icon: House },
  { href: "/transactions", label: "収支", icon: ReceiptJapaneseYen },
  { href: "/analytics", label: "分析", icon: ChartPie },
  { href: "/members", label: "メンバー", icon: Users },
  { href: "/categories", label: "カテゴリ", icon: Tags },
];

/** モバイル下部タブバーに表示するナビ（中央は記録FAB）。 */
export const TAB_ITEMS: NavItem[] = NAV_ITEMS.filter(
  (item) => item.href !== "/categories",
);

/** ホームは完全一致、それ以外はセグメント単位の前方一致でアクティブ判定する。 */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
