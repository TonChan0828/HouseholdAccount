import {
  type ExistingCategory,
  splitCategoryNames,
} from "@/lib/import/excel";
import type { TransactionType } from "@/types";

/** 反映元の収支内容（カテゴリは名前で受け渡し、反映先グループで照合する）。 */
export type MirrorSource = {
  type: TransactionType;
  amount: number;
  date: string; // YYYY-MM-DD
  categoryName: string | null; // null = 未分類
  memo: string | null;
};

/** 反映先グループとそのカテゴリ一覧。 */
export type MirrorTarget = {
  householdId: string;
  categories: ExistingCategory[];
};

/** transactions.insert に渡す反映行。 */
export type MirrorRow = {
  household_id: string;
  created_by: string;
  type: TransactionType;
  amount: number;
  date: string;
  category_id: string | null;
  memo: string | null;
};

/**
 * 反映元の収支を各反映先グループ向けの insert 行に変換する純関数。
 *
 * カテゴリは反映先グループ内で「名前（ケース非依存）+ type」が一致するものに紐付け、
 * 一致が無ければ `category_id = null`（未分類）にする。新規カテゴリは作成しない。
 * 照合は CSV インポートと同じ `splitCategoryNames` を再利用する。
 */
export function buildMirrorRows(
  source: MirrorSource,
  userId: string,
  targets: MirrorTarget[],
): MirrorRow[] {
  return targets.map((target) => ({
    household_id: target.householdId,
    created_by: userId,
    type: source.type,
    amount: source.amount,
    date: source.date,
    category_id: resolveCategoryId(source, target),
    memo: source.memo,
  }));
}

/** 反映先グループで反映元カテゴリ名に一致する id を返す（無ければ null）。 */
function resolveCategoryId(source: MirrorSource, target: MirrorTarget): string | null {
  if (!source.categoryName) {
    return null;
  }
  const { matched } = splitCategoryNames(target.categories, [
    { name: source.categoryName, type: source.type },
  ]);
  return matched[0]?.id ?? null;
}
