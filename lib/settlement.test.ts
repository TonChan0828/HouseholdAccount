import { describe, expect, it } from "vitest";

import {
  buildSettlement,
  settlementsEqual,
  type SettlementResult,
} from "./settlement";

const members = [
  { user_id: "u-1", display_name: "太郎" },
  { user_id: "u-2", display_name: "花子" },
];

const tx = (
  amount: number,
  created_by: string,
  overrides: Partial<{ type: "income" | "expense"; is_shared: boolean }> = {},
) => ({
  amount,
  created_by,
  type: overrides.type ?? ("expense" as const),
  is_shared: overrides.is_shared ?? true,
});

describe("buildSettlement", () => {
  it("2人の立替を均等割りし、差額と送金案を返す", () => {
    const result = buildSettlement([tx(3000, "u-1"), tx(1000, "u-2")], members);

    expect(result.total).toBe(4000);
    expect(result.perMember).toBe(2000);
    expect(result.rows).toEqual([
      { userId: "u-1", displayName: "太郎", paid: 3000, balance: 1000 },
      { userId: "u-2", displayName: "花子", paid: 1000, balance: -1000 },
    ]);
    expect(result.transfers).toEqual([
      { fromUserId: "u-2", toUserId: "u-1", amount: 1000 },
    ]);
  });

  it("is_shared=false・income・脱退者(非メンバー)の取引は対象外", () => {
    const result = buildSettlement(
      [
        tx(3000, "u-1"),
        tx(9999, "u-1", { is_shared: false }),
        tx(5000, "u-1", { type: "income" }),
        tx(7777, "u-gone"), // メンバー一覧にいない登録者
      ],
      members,
    );

    expect(result.total).toBe(3000);
  });

  it("対象取引が0件なら全員 0 円・送金なし", () => {
    const result = buildSettlement([], members);

    expect(result.total).toBe(0);
    expect(result.rows.every((r) => r.paid === 0 && r.balance === 0)).toBe(
      true,
    );
    expect(result.transfers).toEqual([]);
  });

  it("端数は最大剰余法で丸め、balance の合計は必ず 0 になる", () => {
    const three = [...members, { user_id: "u-3", display_name: "次郎" }];
    // 100 ÷ 3 = 33.33…。u-1 が全額立替 → 他の2人の支払い合計と一致する
    const result = buildSettlement([tx(100, "u-1")], three);

    const sum = result.rows.reduce((s, r) => s + r.balance, 0);
    expect(sum).toBe(0);
    expect(result.rows.every((r) => Number.isInteger(r.balance))).toBe(true);
    // 送金合計 = 債権者（u-1）の受取額
    const transferSum = result.transfers.reduce((s, t) => s + t.amount, 0);
    expect(transferSum).toBe(result.rows[0].balance);
  });

  it("送金案は最大 N-1 件に収まる（3人で全員不均等）", () => {
    const three = [...members, { user_id: "u-3", display_name: "次郎" }];
    const result = buildSettlement(
      [tx(6000, "u-1"), tx(3000, "u-2")], // 合計9000 / 3人 = 3000
      three,
    );

    // u-1: +3000, u-2: 0, u-3: -3000 → 送金1件
    expect(result.transfers).toEqual([
      { fromUserId: "u-3", toUserId: "u-1", amount: 3000 },
    ]);
    expect(result.transfers.length).toBeLessThanOrEqual(three.length - 1);
  });

  it("メンバーが1人なら送金なし", () => {
    const result = buildSettlement([tx(3000, "u-1")], [members[0]]);

    expect(result.transfers).toEqual([]);
    expect(result.rows[0].balance).toBe(0); // 3000 - 3000/1
  });

  it("同一人物からの複数取引は合算される", () => {
    const result = buildSettlement(
      [tx(1000, "u-1"), tx(2000, "u-1"), tx(500, "u-2")],
      members,
    );

    const taro = result.rows.find((r) => r.userId === "u-1");
    expect(taro?.paid).toBe(3000);
  });

  it("債権者1人が複数の債務者からgreedyに回収する（複数ラウンド）", () => {
    const three = [...members, { user_id: "u-3", display_name: "次郎" }];
    const result = buildSettlement([tx(3000, "u-1")], three);

    expect(result.rows).toEqual([
      { userId: "u-1", displayName: "太郎", paid: 3000, balance: 2000 },
      { userId: "u-2", displayName: "花子", paid: 0, balance: -1000 },
      { userId: "u-3", displayName: "次郎", paid: 0, balance: -1000 },
    ]);
    expect(result.transfers).toEqual([
      { fromUserId: "u-2", toUserId: "u-1", amount: 1000 },
      { fromUserId: "u-3", toUserId: "u-1", amount: 1000 },
    ]);
  });

  it("最大剰余法の端数配分は決定的である（同じ入力なら常に同じ結果）", () => {
    const three = [...members, { user_id: "u-3", display_name: "次郎" }];
    const result = buildSettlement([tx(100, "u-1")], three);

    expect(result.rows.map((r) => r.balance)).toEqual([66, -33, -33]);
  });
});

describe("settlementsEqual", () => {
  const base = () =>
    buildSettlement([tx(3000, "u-1"), tx(1000, "u-2")], members);

  it("同じ計算結果なら true", () => {
    expect(settlementsEqual(base(), base())).toBe(true);
  });

  it("displayName の違いは差異とみなさない", () => {
    const renamed = buildSettlement(
      [tx(3000, "u-1"), tx(1000, "u-2")],
      [
        { user_id: "u-1", display_name: "改名太郎" },
        { user_id: "u-2", display_name: "花子" },
      ],
    );
    expect(settlementsEqual(base(), renamed)).toBe(true);
  });

  it("金額が変わると false", () => {
    const changed = buildSettlement(
      [tx(3500, "u-1"), tx(1000, "u-2")],
      members,
    );
    expect(settlementsEqual(base(), changed)).toBe(false);
  });

  it("rows の paid/balance が変わると false（displayName 以外の内訳変化を検出する）", () => {
    const resultA: SettlementResult = {
      total: 4000,
      perMember: 2000,
      rows: [
        { userId: "u-1", displayName: "太郎", paid: 3000, balance: 1000 },
        { userId: "u-2", displayName: "花子", paid: 1000, balance: -1000 },
      ],
      transfers: [{ fromUserId: "u-2", toUserId: "u-1", amount: 1000 }],
    };
    const resultB: SettlementResult = {
      ...resultA,
      rows: [
        { userId: "u-1", displayName: "太郎", paid: 2500, balance: 500 },
        { userId: "u-2", displayName: "花子", paid: 1500, balance: -500 },
      ],
    };

    expect(settlementsEqual(resultA, resultB)).toBe(false);
  });
});
