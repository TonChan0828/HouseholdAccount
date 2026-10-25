/** 認証不要（未ログインでもアクセス可）なパスの接頭辞 */
const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/register",
  "/auth",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/demo",
  "/api/cron/recurring",
];

const INVITE_PATH = /^\/invite\/[^/]+$/;

/**
 * 未ログインでもアクセスできるリクエストかを判定する。
 * 機密性のある公開入口はパスと HTTP メソッドの両方を限定する。
 */
export function isPublicPath(pathname: string, method = "GET"): boolean {
  if (pathname === "/") {
    return true;
  }
  if (INVITE_PATH.test(pathname)) {
    return method === "GET" || method === "HEAD";
  }
  if (pathname === "/api/csp-report") {
    return method === "POST";
  }
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * リダイレクト先（`next` クエリ等）を同一オリジン内の相対パスに限定する。
 * オープンリダイレクトを防ぐため、単一スラッシュ始まり（`//` や `/\` は除く）の
 * 相対パスのみ許可し、それ以外は既定値にフォールバックする。
 */
export function safeNextPath(
  next: string | null | undefined,
  fallback = "/reset-password",
): string {
  if (!next) {
    return fallback;
  }
  // 単一スラッシュ始まりのみ許可。`//`（プロトコル相対）と `/\`（バックスラッシュ）は外部誘導になりうるため拒否。
  if (next[0] !== "/" || /[\x00-\x20\x7f\\]/.test(next)) {
    return fallback;
  }
  try {
    const base = new URL("https://internal.invalid");
    const target = new URL(next, base);
    if (target.origin !== base.origin) return fallback;
    // 正規化で先頭に // が現れるパスも、次の解釈で外部URLになるため拒否する。
    if (target.pathname.startsWith("//")) return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}
