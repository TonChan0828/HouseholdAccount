import { describe, expect, it } from "vitest";

import {
  E2E_EPHEMERAL_PREFIX,
  ephemeralName,
  isEphemeralName,
  MULTI_MEMBER_HOUSEHOLD,
  workerFixtures,
} from "./constants";

describe("ephemeralName", () => {
  it("接頭辞付きで、クリーンアップ対象として識別できる名前を生成する", () => {
    const name = ephemeralName("分析");
    expect(name.startsWith(E2E_EPHEMERAL_PREFIX)).toBe(true);
    expect(isEphemeralName(name)).toBe(true);
  });

  it("ラベルを名前に含める", () => {
    expect(ephemeralName("分析")).toContain("分析");
  });
});

describe("isEphemeralName", () => {
  it("接頭辞を持つ名前を一時データと判定する", () => {
    expect(isEphemeralName(`${E2E_EPHEMERAL_PREFIX}グループ-123`)).toBe(true);
  });

  it("seed 済みフィクスチャ（接頭辞なし）をクリーンアップ対象にしない", () => {
    expect(isEphemeralName(MULTI_MEMBER_HOUSEHOLD)).toBe(false);
  });

  it("接頭辞のない一般的なグループ名を一時データと判定しない", () => {
    expect(isEphemeralName("我が家の家計簿")).toBe(false);
  });
});

describe("workerFixtures", () => {
  it("0番は既存の seed 済みフィクスチャを使う", () => {
    expect(workerFixtures(0)).toEqual({
      ownerEmail: "e2e@e2etest.dev",
      memberEmail: "e2e-member@e2etest.dev",
      household: "E2Eダッシュボード-1781044939636",
      storageState: "e2e/.auth/user.json",
    });
  });

  it("並列ワーカー同士でユーザー・グループ・セッションを共有しない", () => {
    const all = Array.from({ length: 8 }, (_, i) => workerFixtures(i));
    for (const key of ["ownerEmail", "memberEmail", "household", "storageState"] as const) {
      expect(new Set(all.map((f) => f[key])).size).toBe(8);
    }
  });

  it("seed 済みフィクスチャはどのワーカーでもクリーンアップ対象にしない", () => {
    expect(isEphemeralName(workerFixtures(7).household)).toBe(false);
  });

  it.each([-1, 8, 1.5, Number.NaN])("用意していないワーカー番号 %s は失敗にする", (i) => {
    expect(() => workerFixtures(i)).toThrow();
  });
});
