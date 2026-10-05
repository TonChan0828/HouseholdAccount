import { expect, it } from "vitest";
import { rateLimitConfigError } from "./runtime-config";
const valid = { RATE_LIMIT_SECRET: "a".repeat(32), NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "server-only" };
it("設定済みの場合はエラーを返さない", () => expect(rateLimitConfigError(valid)).toBeNull());
it("不足・空白・短い秘密値・例示値とDB設定不足を検出し、値は含めない", () => {
  for (const env of [{}, { ...valid, RATE_LIMIT_SECRET: " " .repeat(32) }, { ...valid, RATE_LIMIT_SECRET: "short" }, { ...valid, RATE_LIMIT_SECRET: "replace-with-a-random-secret" }, { ...valid, SUPABASE_SERVICE_ROLE_KEY: "" }]) {
    expect(rateLimitConfigError(env)).toBeTruthy();
    expect(rateLimitConfigError(env)).not.toContain("server-only");
  }
});
