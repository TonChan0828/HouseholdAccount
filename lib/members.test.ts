import { describe, expect, it } from "vitest";

import { summarizeByMember, type MemberInfo, type MemberTx } from "./members";

const tx = (over: Partial<MemberTx>): MemberTx => ({
  amount: 0,
  type: "expense",
  date: "2026-06-10",
  memo: null,
  created_by: "user-1",
  category: null,
  ...over,
});

const members: MemberInfo[] = [
  { user_id: "user-1", display_name: "太郎" },
  { user_id: "user-2", display_name: "花子" },
];

describe("summarizeByMember", () => {
  it("メンバーごとに収入・支出・件数を集計する", () => {
    const txs = [
      tx({ created_by: "user-1", type: "income", amount: 320000 }),
      tx({ created_by: "user-1", type: "expense", amount: 1500 }),
      tx({ created_by: "user-1", type: "expense", amount: 3200 }),
      tx({ created_by: "user-2", type: "expense", amount: 980 }),
    ];

    const result = summarizeByMember(txs, members);

    expect(result).toEqual([
      {
        userId: "user-1",
        displayName: "太郎",
        income: 320000,
        expense: 4700,
        count: 3,
      },
      {
        userId: "user-2",
        displayName: "花子",
        income: 0,
        expense: 980,
        count: 1,
      },
    ]);
  });

  it("取引が0件のメンバーも0で返す", () => {
    const result = summarizeByMember([], members);

    expect(result).toEqual([
      { userId: "user-1", displayName: "太郎", income: 0, expense: 0, count: 0 },
      { userId: "user-2", displayName: "花子", income: 0, expense: 0, count: 0 },
    ]);
  });

  it("members の並び順を維持する", () => {
    const reversed = [...members].reverse();

    const result = summarizeByMember([], reversed);

    expect(result.map((m) => m.userId)).toEqual(["user-2", "user-1"]);
  });

  it("メンバー一覧にいないユーザーの取引は無視する（脱退者など）", () => {
    const txs = [
      tx({ created_by: "user-gone", type: "expense", amount: 500 }),
      tx({ created_by: "user-1", type: "expense", amount: 100 }),
    ];

    const result = summarizeByMember(txs, members);

    expect(result[0]).toMatchObject({ expense: 100, count: 1 });
    expect(result[1]).toMatchObject({ expense: 0, count: 0 });
  });
});
