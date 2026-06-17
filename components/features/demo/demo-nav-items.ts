import {
  House,
  ReceiptJapaneseYen,
  Tags,
  type LucideIcon,
} from "lucide-react";

export type DemoNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** デモモードの主要ナビ（すべて /demo 配下）。 */
export const DEMO_NAV_ITEMS: DemoNavItem[] = [
  { href: "/demo/dashboard", label: "ホーム", icon: House },
  { href: "/demo/transactions", label: "収支", icon: ReceiptJapaneseYen },
  { href: "/demo/categories", label: "カテゴリ", icon: Tags },
];

/** ホームは完全一致、それ以外はセグメント単位の前方一致でアクティブ判定する。 */
export function isDemoNavActive(pathname: string, href: string): boolean {
  if (href === "/demo/dashboard") {
    return pathname === "/demo/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
