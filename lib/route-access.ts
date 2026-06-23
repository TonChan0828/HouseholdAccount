/** 認証不要（未ログインでもアクセス可）なパスの接頭辞 */
const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/register",
  "/auth",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/demo",
];

/**
 * 未ログインでもアクセスできるパスかを判定する。
 * `/`（ランディングページ）は完全一致で公開、それ以外は接頭辞一致で判定する。
 */
export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") {
    return true;
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
  if (next[0] !== "/" || next[1] === "/" || next[1] === "\\") {
    return fallback;
  }
  return next;
}
