import type { MemberInfo } from "@/lib/members";

/** 精算計算に使う取引の最小形（fetchTransactionsInRange の行と構造互換）。 */
export type SettlementTx = {
  amount: number;
  type: "income" | "expense";
  created_by: string;
  is_shared: boolean;
};

export type SettlementMemberRow = {
  userId: string;
  displayName: string;
  paid: number;
  balance: number;
};

export type SettlementTransfer = {
  fromUserId: string;
  toUserId: string;
  amount: number;
};

export type SettlementResult = {
  total: number;
  perMember: number;
  rows: SettlementMemberRow[];
  transfers: SettlementTransfer[];
};

/**
 * 当期の精算対象支出を全メンバーで均等割りする（spec 37）。
 *
 * - 対象は `is_shared = true` かつ `type = "expense"`、登録者が現メンバーの取引のみ
 *   （脱退者の取引は対象外。spec 07 と同じ扱い）
 * - balance は最大剰余法で整数円に丸め、全員の合計が必ず 0 になることを保証する
 * - 送金案は greedy（最大の債務者 → 最大の債権者）で最大 N−1 件に圧縮する
 */
export function buildSettlement(
  txs: SettlementTx[],
  members: MemberInfo[],
): SettlementResult {
  const paidBy = new Map(members.map((m) => [m.user_id, 0]));
  for (const t of txs) {
    if (t.type !== "expense" || !t.is_shared) continue;
    if (!paidBy.has(t.created_by)) continue;
    paidBy.set(t.created_by, (paidBy.get(t.created_by) ?? 0) + t.amount);
  }

  const total = [...paidBy.values()].reduce((s, v) => s + v, 0);
  const n = members.length;
  const share = n > 0 ? total / n : 0;

  // 実数の balance を最大剰余法で整数化する。floor の合計と 0 の差分を
  // 小数部の大きい順に +1 して埋める（同値はメンバー並び順で安定）。
  const raw = members.map((m) => (paidBy.get(m.user_id) ?? 0) - share);
  const balances = raw.map(Math.floor);
  let deficit = 0 - balances.reduce((s, v) => s + v, 0);
  const byFraction = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of byFraction) {
    if (deficit <= 0) break;
    balances[i] += 1;
    deficit -= 1;
  }

  const rows = members.map((m, i) => ({
    userId: m.user_id,
    displayName: m.display_name,
    paid: paidBy.get(m.user_id) ?? 0,
    balance: balances[i],
  }));

  return {
    total,
    perMember: n > 0 ? Math.round(share) : 0,
    rows,
    transfers: buildTransfers(rows),
  };
}

/** 債務者から債権者への送金案を greedy に組む（残額の大きい者同士から消し込む）。 */
function buildTransfers(rows: SettlementMemberRow[]): SettlementTransfer[] {
  const creditors = rows
    .filter((r) => r.balance > 0)
    .map((r) => ({ id: r.userId, rest: r.balance }))
    .sort((a, b) => b.rest - a.rest);
  const debtors = rows
    .filter((r) => r.balance < 0)
    .map((r) => ({ id: r.userId, rest: -r.balance }))
    .sort((a, b) => b.rest - a.rest);

  const transfers: SettlementTransfer[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const amount = Math.min(creditors[ci].rest, debtors[di].rest);
    if (amount > 0) {
      transfers.push({
        fromUserId: debtors[di].id,
        toUserId: creditors[ci].id,
        amount,
      });
    }
    creditors[ci].rest -= amount;
    debtors[di].rest -= amount;
    if (creditors[ci].rest === 0) ci += 1;
    if (debtors[di].rest === 0) di += 1;
  }
  return transfers;
}

/**
 * 精算スナップショットと再計算結果の差異判定（spec 37）。
 * 表示名の変更は差異とみなさないため displayName を除いて比較する。
 */
export function settlementsEqual(
  a: SettlementResult,
  b: SettlementResult,
): boolean {
  const strip = (r: SettlementResult) => ({
    total: r.total,
    perMember: r.perMember,
    rows: r.rows.map(({ userId, paid, balance }) => ({
      userId,
      paid,
      balance,
    })),
    transfers: r.transfers,
  });
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}
