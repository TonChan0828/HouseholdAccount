import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { logServerError, rpc, address } = vi.hoisted(() => ({
  logServerError: vi.fn(),
  rpc: vi.fn(),
  address: { value: "203.0.113.10" },
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": address.value }),
}));
vi.mock("@/lib/observability", () => ({ logServerError }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc }),
}));

import { consumeRateLimit } from "./rate-limit";

afterEach(() => vi.unstubAllEnvs());

describe("consumeRateLimit", () => {
  beforeEach(() => {
    vi.stubEnv("RATE_LIMIT_SECRET", "test-only-secret");
    rpc.mockReset();
    logServerError.mockReset();
    address.value = "203.0.113.10";
  });

  it("IPを変更しても認証のアカウント制限キーを変えない", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const options = { bucket: "auth.login", subject: "USER@example.com", limit: 10, windowSeconds: 900 };
    expect(await consumeRateLimit(options)).toBe("allowed");
    address.value = "203.0.113.99";
    await consumeRateLimit({ ...options, subject: "user@example.com" });
    expect(rpc.mock.calls[0][1]._key_hash).toBe(rpc.mock.calls[1][1]._key_hash);
  });

  it.each([null, 1, "true"])("不正な判定応答 %j を障害として拒否する", async (data) => {
    rpc.mockResolvedValue({ data, error: null });
    expect(await consumeRateLimit({ bucket: "auth.login", subject: "user@example.com", limit: 10, windowSeconds: 900 }))
      .toBe("unavailable");
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
    ).resolves.toBe("limited");

    expect(rpc).toHaveBeenCalledWith("consume_rate_limit", {
      _bucket: "auth.login",
      _key_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      _limit: 10,
      _window_seconds: 900,
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("user@example.com");
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("203.0.113.10");
  });

  it("DB 障害時は拒否し、安全なログを残す", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "sensitive" } });

    await expect(
      consumeRateLimit({
        bucket: "auth.login",
        subject: "user@example.com",
        limit: 10,
        windowSeconds: 900,
      }),
    ).resolves.toBe("unavailable");
    expect(logServerError).toHaveBeenCalledWith(
      "rate_limit.consume_failed",
      expect.anything(),
      { bucket: "auth.login" },
    );
  });
});

it("本番の秘密値が未設定・短い場合は制限を無効化せず拒否する", async () => {
  vi.stubEnv("NODE_ENV", "production");
  for (const secret of ["", "short"]) {
    vi.stubEnv("RATE_LIMIT_SECRET", secret);
    rpc.mockClear();
    await expect(consumeRateLimit({ bucket: "auth.login", subject: "user@example.com", limit: 10, windowSeconds: 900 })).resolves.toBe("unavailable");
    expect(rpc).not.toHaveBeenCalled();
  }
});
it("開発時の未設定はログを残して続行する", async () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("RATE_LIMIT_SECRET", "");
  await expect(consumeRateLimit({ bucket: "auth.login", subject: "user@example.com", limit: 10, windowSeconds: 900 })).resolves.toBe("allowed");
});
