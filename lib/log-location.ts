/** ログ用のURL。利用者の値を含む招待パス、クエリ、フラグメントを記録しない。 */
export function safeLogLocation(value: string): string {
  try {
    const url = new URL(value, "https://log.invalid");
    if (!/^https?:$/.test(url.protocol)) return "[invalid-location]";
    const path = decodeURIComponent(url.pathname).replace(/\/invite\/.*$/gi, "/invite/[token]");
    const origin = /^https?:\/\//i.test(value) ? url.origin : "";
    return `${origin}${path}`.slice(0, 500);
  } catch {
    return "[invalid-location]";
  }
}
