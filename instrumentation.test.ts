import { afterEach, expect, it, vi } from "vitest";
const { log } = vi.hoisted(() => ({ log: vi.fn() }));
vi.mock("@/lib/observability", () => ({ logServerError: log }));
import { register, onRequestError } from "./instrumentation";
afterEach(() => { vi.unstubAllEnvs(); log.mockClear(); });
it("招待画面の例外でもトークンを記録しない", () => {
  onRequestError(new Error("sensitive"), {
    method: "GET", path: "/invite/private-token?key=private-token", headers: {},
  }, {
    routerKind: "App Router", routePath: "/invite/[token]", routeType: "render",
    renderSource: "react-server-components", revalidateReason: undefined,
  });
  expect(JSON.stringify(log.mock.calls)).not.toContain("private-token");
  expect(log).toHaveBeenCalledWith("next.request.error", expect.any(Error),
    expect.objectContaining({ path: "/invite/[token]" }));
});
it("本番起動で秘密値不足を検知し、その値をログへ出さない", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  vi.stubEnv("RATE_LIMIT_SECRET", "private-short-value");
  await expect(register()).rejects.toThrow("RATE_LIMIT_SECRET");
  expect(log).toHaveBeenCalledWith("rate_limit.configuration_invalid", expect.any(Error));
  expect(JSON.stringify(log.mock.calls)).not.toContain("private-short-value");
});
it("本番の設定済みインスタンスと開発起動を許可する", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  vi.stubEnv("RATE_LIMIT_SECRET", "a".repeat(32));
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-placeholder");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
  await expect(register()).resolves.toBeUndefined();
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("RATE_LIMIT_SECRET", "");
  await expect(register()).resolves.toBeUndefined();
});
