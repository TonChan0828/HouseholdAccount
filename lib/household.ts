import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";

export const ACTIVE_HOUSEHOLD_COOKIE = "active_household_id";

/**
 * 現在アクティブな household_id を取得する。
 *
 * 1. Cookie に保存されたグループ ID を優先
 * 2. 無ければ所属する最も古いグループにフォールバック
 *
 * 取得・更新系は必ずこの household_id でスコープすること（user_id 単体は禁止）。
 */
export async function getActiveHouseholdId(): Promise<string | null> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(ACTIVE_HOUSEHOLD_COOKIE)?.value;
  if (fromCookie) {
    return fromCookie;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("household_members")
    .select("household_id")
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data?.household_id ?? null;
}
