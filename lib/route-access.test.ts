import { describe, expect, it } from "vitest";

import { isPublicPath } from "./route-access";

describe("isPublicPath", () => {
  it("ルート / は公開", () => {
    expect(isPublicPath("/")).toBe(true);
  });

  it("/login・/register・/auth 配下は公開", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/register")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
  });

  it("パスワード再設定の各パスは公開", () => {
    expect(isPublicPath("/forgot-password")).toBe(true);
    expect(isPublicPath("/reset-password")).toBe(true);
  });

  it("デモモード（/demo 配下）は公開", () => {
    expect(isPublicPath("/demo")).toBe(true);
    expect(isPublicPath("/demo/dashboard")).toBe(true);
    expect(isPublicPath("/demo/transactions/new")).toBe(true);
  });

  it("ダッシュボード・保護ルートは非公開", () => {
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/transactions")).toBe(false);
    expect(isPublicPath("/households")).toBe(false);
  });
});
