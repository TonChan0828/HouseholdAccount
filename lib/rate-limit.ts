import "server-only";

import { createHmac } from "node:crypto";

import { headers } from "next/headers";

import { rateLimitConfigError } from "@/lib/runtime-config";
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
 * 本番の設定不備は拒否する。開発時の未設定や一時的なDB障害はログを残して続行する。
 */
export async function consumeRateLimit(options: RateLimitOptions): Promise<boolean> {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret || (process.env.NODE_ENV === "production" && rateLimitConfigError(process.env))) {
    logServerError("rate_limit.configuration_invalid", new Error("InvalidRateLimitConfig"), {
      bucket: options.bucket,
    });
    return process.env.NODE_ENV !== "production";
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
