/** 認証不要（未ログインでもアクセス可）なパスの接頭辞 */
const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/register",
  "/auth",
  "/forgot-password",
  "/reset-password",
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
