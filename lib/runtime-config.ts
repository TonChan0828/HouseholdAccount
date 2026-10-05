/** 秘密値そのものをログへ出さず、本番のアクセス回数制限の設定を検査する。 */
export function rateLimitConfigError(env: Record<string, string | undefined>): string | null {
  if (
    !env.RATE_LIMIT_SECRET ||
    Buffer.byteLength(env.RATE_LIMIT_SECRET.trim(), "utf8") < 32 ||
    env.RATE_LIMIT_SECRET === "replace-with-a-random-secret"
  ) {
    return "RATE_LIMIT_SECRET must contain at least 32 bytes of a random secret";
  }
  if (!env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return "Rate limiting requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY";
  }
  return null;
}
