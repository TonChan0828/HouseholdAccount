import { logServerError } from "@/lib/observability";

export const dynamic = "force-dynamic";

const MAX_REPORT_BYTES = 32 * 1024;

function safeLocation(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`.slice(0, 500);
  } catch {
    return value.split("?", 1)[0].slice(0, 500);
  }
}

export async function POST(request: Request): Promise<Response> {
  const declaredSize = Number(request.headers.get("content-length") ?? "0");
  if (declaredSize > MAX_REPORT_BYTES) {
    return new Response(null, { status: 413 });
  }

  const text = await request.text();
  if (text.length > MAX_REPORT_BYTES) {
    return new Response(null, { status: 413 });
  }

  try {
    const body = JSON.parse(text) as Record<string, unknown>;
    const report = (body["csp-report"] ?? body.body ?? body) as Record<
      string,
      unknown
    >;
    logServerError("csp.violation", new Error("CspViolation"), {
      directive: String(
        report["effective-directive"] ?? report.effectiveDirective ?? "unknown",
      ).slice(0, 120),
      document: safeLocation(
        report["document-uri"] ?? report.documentURL ?? report.url,
      ),
      blocked: safeLocation(
        report["blocked-uri"] ?? report.blockedURL,
      ),
    });
  } catch {
    return new Response(null, { status: 400 });
  }

  return new Response(null, { status: 204 });
}
