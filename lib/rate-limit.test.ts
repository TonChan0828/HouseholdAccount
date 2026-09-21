import { beforeEach, describe, expect, it, vi } from "vitest";

const { logServerError, rpc } = vi.hoisted(() => ({
  logServerError: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": "203.0.113.10" }),
}));
vi.mock("@/lib/observability", () => ({ logServerError }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc }),
}));

import { consumeRateLimit } from "./rate-limit";

describe("consumeRateLimit", () => {
  beforeEach(() => {
    vi.stubEnv("RATE_LIMIT_SECRET", "test-only-secret");
    rpc.mockReset();
    logServerError.mockReset();
  });

  it("生の識別子を送らず RPC の判定を返す", async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    await expect(
      consumeRateLimit({
        bucket: "auth.login",
        subject: "USER@EXAMPLE.COM",
        limit: 10,
        windowSeconds: 900,
      }),
    ).resolves.toBe(false);

    expect(rpc).toHaveBeenCalledWith("consume_rate_limit", {
      _bucket: "auth.login",
      _key_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      _limit: 10,
      _window_seconds: 900,
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("user@example.com");
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("203.0.113.10");
  });

  it("DB 障害時は処理を継続し、安全なログを残す", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "sensitive" } });

    await expect(
      consumeRateLimit({
        bucket: "auth.login",
        subject: "user@example.com",
        limit: 10,
        windowSeconds: 900,
      }),
    ).resolves.toBe(true);
    expect(logServerError).toHaveBeenCalledWith(
      "rate_limit.consume_failed",
      expect.anything(),
      { bucket: "auth.login" },
    );
  });
});
