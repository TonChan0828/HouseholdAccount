function originOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

export function contentSecurityPolicy(options?: {
  isDevelopment?: boolean;
  supabaseUrl?: string;
}): string {
  const isDevelopment = options?.isDevelopment ?? false;
  const supabaseOrigin = originOf(options?.supabaseUrl);
  const connectSources = [
    "'self'",
    supabaseOrigin,
    "https://cdn.jsdelivr.net",
  ].filter(Boolean);

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""} https://cdn.jsdelivr.net`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    `connect-src ${connectSources.join(" ")}`,
    "worker-src 'self' blob: https://cdn.jsdelivr.net",
    "child-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    "report-uri /api/csp-report",
  ].join("; ");
}

export function cspHeader(): { key: string; value: string } {
  return {
    key:
      process.env.CSP_ENFORCE === "true"
        ? "Content-Security-Policy"
        : "Content-Security-Policy-Report-Only",
    value: contentSecurityPolicy({
      isDevelopment: process.env.NODE_ENV === "development",
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    }),
  };
}
