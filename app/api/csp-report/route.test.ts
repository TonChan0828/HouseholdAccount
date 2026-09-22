import { beforeEach, describe, expect, it, vi } from "vitest";

const { consumeRateLimit, logServerError } = vi.hoisted(() => ({
  consumeRateLimit: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock("@/lib/observability", () => ({ logServerError }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit }));

import { POST } from "./route";

describe("POST /api/csp-report", () => {
  beforeEach(() => {
    logServerError.mockReset();
    consumeRateLimit.mockReset();
    consumeRateLimit.mockResolvedValue(true);
  });

  it("URL のクエリを除去して違反を構造化ログに記録する", async () => {
    const response = await POST(
      new Request("http://localhost/api/csp-report", {
        method: "POST",
        headers: { "content-type": "application/csp-report" },
        body: JSON.stringify({
          "csp-report": {
            "effective-directive": "script-src-elem",
            "document-uri": "https://example.com/dashboard?token=secret",
            "blocked-uri": "https://cdn.example.com/script.js?key=secret",
          },
        }),
      }),
    );

    expect(response.status).toBe(204);
    expect(logServerError).toHaveBeenCalledWith(
      "csp.violation",
      expect.any(Error),
      {
        directive: "script-src-elem",
        document: "https://example.com/dashboard",
        blocked: "https://cdn.example.com/script.js",
      },
    );
  });

  it("不正な JSON を拒否する", async () => {
    const response = await POST(
      new Request("http://localhost/api/csp-report", {
        method: "POST",
        headers: { "content-type": "application/csp-report" },
        body: "not-json",
      }),
    );

    expect(response.status).toBe(400);
    expect(logServerError).not.toHaveBeenCalled();
  });

  it("大きすぎるレポートを読み込まず拒否する", async () => {
    const response = await POST(
      new Request("http://localhost/api/csp-report", {
        method: "POST",
        body: "{}",
        headers: {
          "content-length": String(32 * 1024 + 1),
          "content-type": "application/csp-report",
        },
      }),
    );

    expect(response.status).toBe(413);
    expect(logServerError).not.toHaveBeenCalled();
    expect(consumeRateLimit).not.toHaveBeenCalled();
  });

  it("未対応の Content-Type を拒否する", async () => {
    const response = await POST(
      new Request("http://localhost/api/csp-report", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "{}",
      }),
    );

    expect(response.status).toBe(415);
    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(logServerError).not.toHaveBeenCalled();
  });

  it("レート上限を超えたレポートを拒否する", async () => {
    consumeRateLimit.mockResolvedValue(false);

    const response = await POST(
      new Request("http://localhost/api/csp-report", {
        method: "POST",
        headers: { "content-type": "application/reports+json" },
        body: JSON.stringify([{ body: { effectiveDirective: "script-src" } }]),
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(logServerError).not.toHaveBeenCalled();
  });

  it("任意文字列を directive としてログに残さない", async () => {
    const response = await POST(
      new Request("http://localhost/api/csp-report", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          "effective-directive": "token=secret value",
          "document-uri": "https://example.com/path?token=secret",
        }),
      }),
    );

    expect(response.status).toBe(204);
    expect(logServerError).toHaveBeenCalledWith(
      "csp.violation",
      expect.any(Error),
      expect.objectContaining({
        directive: "unknown",
        document: "https://example.com/path",
      }),
    );
  });
});
