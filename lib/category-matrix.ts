/**
 * メンバー別カテゴリマトリクスの集計ロジック（純関数）。
 *
 * DB ではなく JS 側で集計し、ユニットテストで検証する。
 * 行=カテゴリ / 列=メンバー の転置マトリクスを支出・収入のセクション別に構築する。
 */

import type { MemberInfo } from "@/lib/members";

export type MatrixTx = {
  amount: number;
  type: "income" | "expense";
  created_by: string;
  category_id: string | null;
  category: { name: string; color: string | null } | null;
};

/** マトリクスの1行（カテゴリ）。cells は members と同順・同長。 */
export type MatrixRow = {
  categoryId: string | null;
  name: string;
  color: string;
  cells: number[];
  total: number;
};

/** 支出・収入それぞれのセクション。 */
export type MatrixSection = {
  rows: MatrixRow[];
  memberTotals: number[];
  total: number;
};

export type CategoryMemberMatrix = {
  members: { userId: string; displayName: string }[];
  expense: MatrixSection;
  income: MatrixSection;
};

const UNCATEGORIZED_NAME = "未分類";
const UNCATEGORIZED_COLOR = "#999";

/**
 * 取引をカテゴリ×メンバーへ集計する。members の並び順を列順として維持し、
 * members にいないユーザー（脱退者など）の取引は無視する。
 * セクションの振り分けは取引の type で行う（both 型カテゴリは両方に現れ得る）。
 */
export function buildCategoryMemberMatrix(
  txs: MatrixTx[],
  members: MemberInfo[],
): CategoryMemberMatrix {
  const memberIndex = new Map(members.map((m, i) => [m.user_id, i]));

  const buildSection = (type: "income" | "expense"): MatrixSection => {
    const byCategory = new Map<string, MatrixRow>();
    const memberTotals = members.map(() => 0);
    let total = 0;

    for (const t of txs) {
      if (t.type !== type) continue;
      const index = memberIndex.get(t.created_by);
      if (index === undefined) continue;

      const key = t.category_id ?? "__none__";
      let row = byCategory.get(key);
      if (!row) {
        row = {
          categoryId: t.category_id,
          name: t.category?.name ?? UNCATEGORIZED_NAME,
          color: t.category?.color ?? UNCATEGORIZED_COLOR,
          cells: members.map(() => 0),
          total: 0,
        };
        byCategory.set(key, row);
      }
      row.cells[index] += t.amount;
      row.total += t.amount;
      memberTotals[index] += t.amount;
      total += t.amount;
    }

    return {
      rows: [...byCategory.values()].sort((a, b) => b.total - a.total),
      memberTotals,
      total,
    };
  };

  return {
    members: members.map((m) => ({
      userId: m.user_id,
      displayName: m.display_name,
    })),
    expense: buildSection("expense"),
    income: buildSection("income"),
  };
}
