/**
 * メンバー別カテゴリマトリクスの集計ロジック（純関数）。
 *
 * DB ではなく JS 側で集計し、ユニットテストで検証する。
 * 行=カテゴリ / 列=メンバー の転置マトリクスを支出・収入のセクション別に構築する。
 */

import type { MemberInfo } from "@/lib/members";
import { attributedTo, type Attributable } from "@/lib/transactions/attribution";

export type MatrixTx = Attributable & {
  amount: number;
  type: "income" | "expense";
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
const FORMER_MEMBERS_COLUMN = {
  userId: "__former_members__",
  displayName: "脱退メンバー",
} as const;

/**
 * 取引をカテゴリ×メンバーへ集計する。members の並び順を列順として維持し、
 * members にいない帰属ユーザーの取引は、個人を特定せず「脱退メンバー」列に集約する。
 * 列の振り分けは入力者ではなく帰属ユーザー（名義人。spec 41）で行う。
 * セクションの振り分けは取引の type で行う（both 型カテゴリは両方に現れ得る）。
 */
export function buildCategoryMemberMatrix(
  txs: MatrixTx[],
  members: MemberInfo[],
): CategoryMemberMatrix {
  const memberIndex = new Map(members.map((m, i) => [m.user_id, i]));
  const hasFormerMemberTransactions = txs.some(
    (t) => !memberIndex.has(attributedTo(t)),
  );
  const columns = [
    ...members.map((m) => ({ userId: m.user_id, displayName: m.display_name })),
    ...(hasFormerMemberTransactions ? [FORMER_MEMBERS_COLUMN] : []),
  ];
  const formerMembersIndex = hasFormerMemberTransactions ? members.length : -1;

  const buildSection = (type: "income" | "expense"): MatrixSection => {
    const byCategory = new Map<string, MatrixRow>();
    const memberTotals = columns.map(() => 0);
    let total = 0;

    for (const t of txs) {
      if (t.type !== type) continue;
      const index = memberIndex.get(attributedTo(t)) ?? formerMembersIndex;

      const key = t.category_id ?? "__none__";
      let row = byCategory.get(key);
      if (!row) {
        row = {
          categoryId: t.category_id,
          name: t.category?.name ?? UNCATEGORIZED_NAME,
          color: t.category?.color ?? UNCATEGORIZED_COLOR,
          cells: columns.map(() => 0),
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
    members: columns,
    expense: buildSection("expense"),
    income: buildSection("income"),
  };
}
