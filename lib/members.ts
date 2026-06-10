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
