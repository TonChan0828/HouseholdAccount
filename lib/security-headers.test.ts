import { afterEach, describe, expect, it, vi } from "vitest";

import { contentSecurityPolicy, cspHeader } from "./security-headers";

describe("contentSecurityPolicy", () => {
  it("Supabaseはoriginだけをconnect-srcへ許可する", () => {
    const policy = contentSecurityPolicy({
      supabaseUrl: "https://project.supabase.co/rest/v1?apikey=secret",
    });

    expect(policy).toContain(
      "connect-src 'self' https://project.supabase.co https://cdn.jsdelivr.net",
    );
    expect(policy).not.toContain("apikey");
    expect(policy).toContain("worker-src 'self' blob: https://cdn.jsdelivr.net");
    expect(policy).toContain("report-uri /api/csp-report");
  });

  it("unsafe-evalは開発時だけ許可する", () => {
    expect(contentSecurityPolicy({ isDevelopment: true })).toContain(
      "'unsafe-eval'",
    );
    expect(contentSecurityPolicy({ isDevelopment: false })).not.toContain(
      "'unsafe-eval'",
    );
  });
});

describe("cspHeader", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("既定はReport-Onlyで段階導入する", () => {
    vi.stubEnv("CSP_ENFORCE", "false");
    expect(cspHeader().key).toBe("Content-Security-Policy-Report-Only");
  });

  it("明示設定後だけ強制モードへ切り替える", () => {
    vi.stubEnv("CSP_ENFORCE", "true");
    expect(cspHeader().key).toBe("Content-Security-Policy");
  });
});
