import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";

export const ACTIVE_HOUSEHOLD_COOKIE = "active_household_id";

/** アクティブグループの Cookie を設定する（グループ作成・切り替え・招待参加時に使う）。 */
export async function setActiveHouseholdCookie(householdId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_HOUSEHOLD_COOKIE, householdId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1年
  });
}

/**
 * 現在アクティブな household_id を取得する。
 *
 * 1. Cookie に保存されたグループ ID を、自分の所属グループであることを検証した上で優先
 * 2. 非所属・未設定なら所属する最も古いグループにフォールバック
 *
 * Cookie はクライアント側で改ざんできるため、検証なしに信頼してはならない（RLS 頼みにしない）。
 * 取得・更新系は必ずこの household_id でスコープすること（user_id 単体は禁止）。
 */
export async function getActiveHouseholdId(): Promise<string | null> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(ACTIVE_HOUSEHOLD_COOKIE)?.value;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  if (fromCookie) {
    const { data: membership } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .eq("household_id", fromCookie)
      .maybeSingle();
    if (membership) {
      return fromCookie;
    }
  }

  // RLS は同居メンバー全員の行を返すため、自分の参加日時で最古のグループを選ぶ。
  const { data } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data?.household_id ?? null;
}
