import { logServerError } from "@/lib/observability";
import { consumeRateLimit } from "@/lib/rate-limit";
import { safeLogLocation } from "@/lib/log-location";
import { BodyReadError, readLimitedBody } from "@/lib/read-limited-body";

export const dynamic = "force-dynamic";

const MAX_REPORT_BYTES = 32 * 1024;
const REPORT_CONTENT_TYPES = new Set([
  "application/csp-report",
  "application/json",
  "application/reports+json",
]);

function reportContentType(request: Request): string {
  return (
    request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase() ?? ""
  );
}

function reportRecord(value: unknown): Record<string, unknown> | null {
  const root = Array.isArray(value) ? value[0] : value;
  if (typeof root !== "object" || root === null || Array.isArray(root)) {
    return null;
  }
  const record = root as Record<string, unknown>;
  const report = record["csp-report"] ?? record.body ?? record;
  return typeof report === "object" && report !== null && !Array.isArray(report)
    ? (report as Record<string, unknown>)
    : null;
}

function safeDirective(value: unknown): string {
  return typeof value === "string" && /^[a-z][a-z0-9-]{0,119}$/.test(value)
    ? value
    : "unknown";
}

function safeLocation(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return safeLogLocation(value);
}

export async function POST(request: Request): Promise<Response> {
  if (!REPORT_CONTENT_TYPES.has(reportContentType(request))) {
    return new Response(null, { status: 415 });
  }

  const declaredSize = Number(request.headers.get("content-length") ?? "0");
  if (declaredSize > MAX_REPORT_BYTES) {
    return new Response(null, { status: 413 });
  }

  const rateLimit = await consumeRateLimit({
    bucket: "csp.report",
    subject: "browser",
    limit: 60,
    windowSeconds: 60,
  });
  if (rateLimit !== "allowed") {
    return new Response(null, {
      status: rateLimit === "unavailable" ? 503 : 429,
      headers: { "Retry-After": "60" },
    });
  }

  try {
    const text = await readLimitedBody(request, MAX_REPORT_BYTES, 5000);
    const report = reportRecord(JSON.parse(text));
    if (!report) return new Response(null, { status: 400 });
    logServerError("csp.violation", new Error("CspViolation"), {
      directive: safeDirective(
        report["effective-directive"] ?? report.effectiveDirective,
      ),
      document: safeLocation(
        report["document-uri"] ?? report.documentURL ?? report.url,
      ),
      blocked: safeLocation(
        report["blocked-uri"] ?? report.blockedURL,
      ),
    });
  } catch (error) {
    return new Response(null, { status: error instanceof BodyReadError ? error.status : 400 });
  }

  return new Response(null, { status: 204 });
}
