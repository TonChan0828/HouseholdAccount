import "server-only";

import { createHmac } from "node:crypto";

import { headers } from "next/headers";

import { logServerError } from "@/lib/observability";
import { createAdminClient } from "@/lib/supabase/admin";

type RateLimitOptions = {
  bucket: string;
  subject: string;
  limit: number;
  windowSeconds: number;
  includeIp?: boolean;
};

function clientAddress(headerList: Headers): string {
  const forwarded = headerList.get("x-forwarded-for");
  return (
    headerList.get("x-real-ip") ?? forwarded?.split(",").at(-1)?.trim() ?? "unknown"
  );
}

/**
 * Supabase の原子的カウンターを使い、サーバーインスタンスをまたいで試行を制限する。
 * 設定不備や一時的な DB 障害では可用性を優先して許可するが、安全な構造化ログを残す。
 */
export async function consumeRateLimit(options: RateLimitOptions): Promise<boolean> {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret) {
    logServerError("rate_limit.configuration_missing", new Error("MissingSecret"), {
      bucket: options.bucket,
    });
    return true;
  }

  const headerList = options.includeIp === false ? null : await headers();
  const keyMaterial = `${options.subject.trim().toLowerCase()}|${
    headerList ? clientAddress(headerList) : "no-ip"
  }`;
  const keyHash = createHmac("sha256", secret).update(keyMaterial).digest("hex");

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("consume_rate_limit", {
      _bucket: options.bucket,
      _key_hash: keyHash,
      _limit: options.limit,
      _window_seconds: options.windowSeconds,
    });
    if (error) throw error;
    return data === true;
  } catch (error) {
    logServerError("rate_limit.consume_failed", error, {
      bucket: options.bucket,
    });
    return true;
  }
}
