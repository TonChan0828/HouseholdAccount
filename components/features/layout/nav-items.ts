import {
  CalendarDays,
  ChartPie,
  House,
  ReceiptJapaneseYen,
  Tags,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** ヘッダー（デスクトップ）に表示する主要ナビ。 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "ホーム", icon: House },
  { href: "/transactions", label: "収支", icon: ReceiptJapaneseYen },
  { href: "/calendar", label: "カレンダー", icon: CalendarDays },
  { href: "/analytics", label: "分析", icon: ChartPie },
  { href: "/budgets", label: "予算", icon: Wallet },
  { href: "/members", label: "メンバー", icon: Users },
  { href: "/categories", label: "カテゴリ", icon: Tags },
];

/**
 * モバイル下部タブバーに表示するナビ（中央は記録FAB）。
 * 中央 FAB を挟んで左右対称（2:2）に保つため 4 件に絞る。
 * カテゴリ・予算は管理/設定系、カレンダーは収支の別ビュー（収支ページのトグルから遷移）のため除外する。
 */
const TAB_EXCLUDED = new Set(["/categories", "/calendar", "/budgets"]);
export const TAB_ITEMS: NavItem[] = NAV_ITEMS.filter(
  (item) => !TAB_EXCLUDED.has(item.href),
);

/** ホームは完全一致、それ以外はセグメント単位の前方一致でアクティブ判定する。 */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
