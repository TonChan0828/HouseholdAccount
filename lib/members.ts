/**
 * メンバー別アクティビティの集計ロジック（純関数）。
 *
 * DB ではなく JS 側で集計し、ユニットテストで検証する。
 */

export type MemberTx = {
  amount: number;
  type: "income" | "expense";
  date: string; // YYYY-MM-DD
  memo: string | null;
  created_by: string;
  category: { name: string; color: string | null } | null;
};

export type MemberInfo = {
  user_id: string;
  display_name: string;
};

/** メンバーごとの当期集計。 */
export type MemberSummary = {
  userId: string;
  displayName: string;
  income: number;
  expense: number;
  count: number;
};

/**
 * メンバーのインデックスから distinct なアクセント色を返す（人数無制限）。
 *
 * 黄金角（137.5度）に近いステップで色相を回すことで、隣接インデックスはもちろん
 * 何人いても色が被りにくい。明度はアバターの白文字が WCAG AA（4.5:1）を満たす
 * よう L=0.52 に抑える（oklch は色相に依らず明度が均一なので全色で AA を満たす）。
 */
export function memberColor(index: number): string {
  const hue = ((index * 137.5) % 360).toFixed(1);
  return `oklch(0.52 0.12 ${hue})`;
}

/**
 * 取引をメンバーごとに集計する。members の並び順を維持し、
 * members にいないユーザー（脱退者など）の取引は無視する。
 */
export function summarizeByMember(
  txs: MemberTx[],
  members: MemberInfo[],
): MemberSummary[] {
  const byUser = new Map<string, MemberSummary>(
    members.map((m) => [
      m.user_id,
      {
        userId: m.user_id,
        displayName: m.display_name,
        income: 0,
        expense: 0,
        count: 0,
      },
    ]),
  );

  for (const t of txs) {
    const summary = byUser.get(t.created_by);
    if (!summary) continue;
    if (t.type === "income") summary.income += t.amount;
    else summary.expense += t.amount;
    summary.count += 1;
  }

  return [...byUser.values()];
}
