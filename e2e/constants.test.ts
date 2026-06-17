import { describe, expect, it } from "vitest";

import {
  E2E_EPHEMERAL_PREFIX,
  ephemeralName,
  isEphemeralName,
  MULTI_MEMBER_HOUSEHOLD,
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
