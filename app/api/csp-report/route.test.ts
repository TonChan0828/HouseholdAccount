import { beforeEach, describe, expect, it, vi } from "vitest";

const { logServerError } = vi.hoisted(() => ({ logServerError: vi.fn() }));

vi.mock("@/lib/observability", () => ({ logServerError }));

import { POST } from "./route";

describe("POST /api/csp-report", () => {
  beforeEach(() => {
    logServerError.mockReset();
  });

  it("URL のクエリを除去して違反を構造化ログに記録する", async () => {
    const response = await POST(
      new Request("http://localhost/api/csp-report", {
        method: "POST",
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
        headers: { "content-length": String(32 * 1024 + 1) },
      }),
    );

    expect(response.status).toBe(413);
    expect(logServerError).not.toHaveBeenCalled();
  });
});
