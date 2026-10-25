import "server-only";

import { createHmac } from "node:crypto";
import { isIP } from "node:net";

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

export type RateLimitResult = "allowed" | "limited" | "unavailable";
export const RATE_LIMIT_UNAVAILABLE_MESSAGE =
  "現在この操作を利用できません。しばらく待ってからお試しください";

function clientAddress(headerList: Headers): string {
  // 本番はVercelが上書きするヘッダーのみを信頼する。
  // 別の配信基盤では利用者の任意ヘッダーを信用せず、共通の制限キーを使う。
  if (process.env.NODE_ENV === "production" && process.env.VERCEL !== "1") return "unknown";
  const address = headerList.get("x-real-ip")?.trim();
  return address && isIP(address) ? address : "unknown";
}

/**
 * Supabase の原子的カウンターを使い、サーバーインスタンスをまたいで試行を制限する。
 * 開発時の未設定を除き、設定不備とDB障害は拒否する。
 */
export async function consumeRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret || (process.env.NODE_ENV === "production" && rateLimitConfigError(process.env))) {
    logServerError("rate_limit.configuration_invalid", new Error("InvalidRateLimitConfig"), {
      bucket: options.bucket,
    });
    return process.env.NODE_ENV === "development" ? "allowed" : "unavailable";
  }

  // 認証はメール単位の上限とし、IP変更による回避を防ぐ。
  const includeIp = options.includeIp !== false && !options.bucket.startsWith("auth.");
  const headerList = includeIp ? await headers() : null;
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
    if (typeof data !== "boolean") throw new Error("InvalidRateLimitResponse");
    return data ? "allowed" : "limited";
  } catch (error) {
    logServerError("rate_limit.consume_failed", error, {
      bucket: options.bucket,
    });
    return "unavailable";
  }
}
