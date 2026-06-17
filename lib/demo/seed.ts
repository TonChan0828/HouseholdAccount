/**
 * デモモードの初期サンプルデータ生成。
 *
 * 当期（今月）内の日付で収支を生成し、リロードのたびに新しい uuid で組み立て直す。
 */

import { toISODate } from "@/lib/period";
import type { Category } from "@/types";

import type { DemoState } from "./store";

export const DEMO_HOUSEHOLD_ID = "demo-household";
export const DEMO_USER_ID = "demo-user-you";
export const DEMO_PARTNER_ID = "demo-user-partner";

// seed の ID は決定論的にする（SSR とクライアントで同じ値になり、ハイドレーション不一致を防ぐ）。
// カテゴリIDは収支フォームの Zod 検証で uuid 形式を要求されるため、v4 形式の固定 uuid を採番する。
const demoUuid = (prefix: string, n: number): string =>
  `${prefix}-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

type SeedCategory = {
  name: string;
  color: string;
  type: Category["type"];
  is_default: boolean;
};

// デフォルト（編集/削除不可）＋カスタム（編集/削除可）を混在させる。
// 色はすべて CATEGORY_COLORS のプリセットから選ぶ（編集フォームの選択状態と整合させるため）。
const SEED_CATEGORIES: SeedCategory[] = [
  { name: "食費", color: "#ef4444", type: "expense", is_default: true },
  { name: "日用品", color: "#f59e0b", type: "expense", is_default: true },
  { name: "交通費", color: "#0ea5e9", type: "expense", is_default: true },
  { name: "住居費", color: "#8b5cf6", type: "expense", is_default: true },
  { name: "娯楽", color: "#ec4899", type: "expense", is_default: true },
  { name: "給与", color: "#22c55e", type: "income", is_default: true },
  { name: "その他", color: "#14b8a6", type: "both", is_default: true },
  { name: "ペット", color: "#84cc16", type: "expense", is_default: false },
  { name: "副業", color: "#10b981", type: "income", is_default: false },
];

type SeedTx = {
  /** その月の日（1始まり）。today を超える分は today に丸める。 */
  day: number;
  type: "income" | "expense";
  amount: number;
  categoryName: string | null;
  memo: string | null;
  byPartner?: boolean;
};

const SEED_TRANSACTIONS: SeedTx[] = [
  { day: 1, type: "income", amount: 280000, categoryName: "給与", memo: "今月のお給料", byPartner: false },
  { day: 1, type: "income", amount: 220000, categoryName: "給与", memo: null, byPartner: true },
  { day: 2, type: "expense", amount: 85000, categoryName: "住居費", memo: "家賃", byPartner: false },
  { day: 3, type: "expense", amount: 4200, categoryName: "食費", memo: "スーパー", byPartner: true },
  { day: 5, type: "expense", amount: 1800, categoryName: "日用品", memo: "ドラッグストア", byPartner: false },
  { day: 7, type: "expense", amount: 3600, categoryName: "娯楽", memo: "映画", byPartner: true },
  { day: 9, type: "expense", amount: 2400, categoryName: "交通費", memo: null, byPartner: false },
  { day: 12, type: "expense", amount: 5200, categoryName: "食費", memo: "外食", byPartner: true },
  { day: 14, type: "income", amount: 15000, categoryName: "副業", memo: "ハンドメイド販売", byPartner: false },
  { day: 16, type: "expense", amount: 3000, categoryName: "ペット", memo: "ペットフード", byPartner: false },
  { day: 18, type: "expense", amount: 6800, categoryName: "食費", memo: "まとめ買い", byPartner: true },
  { day: 20, type: "expense", amount: 1200, categoryName: null, memo: "コンビニ", byPartner: false },
];

/** seed から初期状態を組み立てる。 */
export function createSeedState(): DemoState {
  const categories: Category[] = SEED_CATEGORIES.map((c, i) => ({
    id: demoUuid("ca700000", i + 1),
    household_id: DEMO_HOUSEHOLD_ID,
    name: c.name,
    color: c.color,
    type: c.type,
    icon: null,
    is_default: c.is_default,
  }));
  const categoryIdByName = new Map(categories.map((c) => [c.name, c.id]));

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const today = now.getUTCDate();

  const transactions = SEED_TRANSACTIONS.map((t, i) => {
    const day = Math.min(t.day, today);
    const date = toISODate(new Date(Date.UTC(year, month, day)));
    return {
      id: demoUuid("01d00000", i + 1),
      household_id: DEMO_HOUSEHOLD_ID,
      created_by: t.byPartner ? DEMO_PARTNER_ID : DEMO_USER_ID,
      // 表示には使わないが、決定論的に保つため日付から導出する。
      created_at: `${date}T00:00:00.000Z`,
      type: t.type,
      amount: t.amount,
      date,
      category_id: t.categoryName
        ? (categoryIdByName.get(t.categoryName) ?? null)
        : null,
      memo: t.memo,
    };
  });

  return {
    household: {
      id: DEMO_HOUSEHOLD_ID,
      name: "デモ家計簿",
      period_start_day: 1,
    },
    currentUserId: DEMO_USER_ID,
    members: [
      { user_id: DEMO_USER_ID, display_name: "あなた" },
      { user_id: DEMO_PARTNER_ID, display_name: "パートナー" },
    ],
    categories,
    transactions,
  };
}
