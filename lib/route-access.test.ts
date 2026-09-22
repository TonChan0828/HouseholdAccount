import { describe, expect, it } from "vitest";

import { isPublicPath, safeNextPath } from "./route-access";

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

  it("メール確認の案内ページ（/verify-email）は公開", () => {
    expect(isPublicPath("/verify-email")).toBe(true);
  });

  it("デモモード（/demo 配下）は公開", () => {
    expect(isPublicPath("/demo")).toBe(true);
    expect(isPublicPath("/demo/dashboard")).toBe(true);
    expect(isPublicPath("/demo/transactions/new")).toBe(true);
  });

  it("Cron endpoint は独自のBearer認証を行うためproxyでは公開", () => {
    expect(isPublicPath("/api/cron/recurring")).toBe(true);
  });

  it("招待ページは単一トークン階層の GET・HEAD だけを公開する", () => {
    expect(isPublicPath("/invite/invalid-token", "GET")).toBe(true);
    expect(isPublicPath("/invite/invalid-token", "HEAD")).toBe(true);
    expect(isPublicPath("/invite/invalid-token", "POST")).toBe(false);
    expect(isPublicPath("/invite", "GET")).toBe(false);
    expect(isPublicPath("/invite/token/extra", "GET")).toBe(false);
  });

  it("CSP report endpoint は POST だけを公開する", () => {
    expect(isPublicPath("/api/csp-report", "POST")).toBe(true);
    expect(isPublicPath("/api/csp-report", "GET")).toBe(false);
    expect(isPublicPath("/api/csp-report/extra", "POST")).toBe(false);
  });

  it("ダッシュボード・保護ルートは非公開", () => {
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/transactions")).toBe(false);
    expect(isPublicPath("/households")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("単一スラッシュ始まりの相対パスはそのまま許可する", () => {
    expect(safeNextPath("/reset-password")).toBe("/reset-password");
    expect(safeNextPath("/households")).toBe("/households");
  });

  it("クエリ付きの相対パスも許可する", () => {
    expect(safeNextPath("/reset-password?foo=1")).toBe("/reset-password?foo=1");
  });

  it("プロトコル相対 URL（//evil.com）は拒否して既定値にフォールバックする", () => {
    expect(safeNextPath("//evil.com")).toBe("/reset-password");
  });

  it("バックスラッシュ始まり（/\\evil.com）は拒否する", () => {
    expect(safeNextPath("/\\evil.com")).toBe("/reset-password");
  });

  it("絶対 URL（https://evil.com）は拒否する", () => {
    expect(safeNextPath("https://evil.com")).toBe("/reset-password");
  });

  it("スラッシュ始まりでない値は拒否する", () => {
    expect(safeNextPath("evil")).toBe("/reset-password");
  });

  it("null・空文字は既定値にフォールバックする", () => {
    expect(safeNextPath(null)).toBe("/reset-password");
    expect(safeNextPath("")).toBe("/reset-password");
  });

  it("既定値は引数で上書きできる", () => {
    expect(safeNextPath(null, "/login")).toBe("/login");
  });
});
