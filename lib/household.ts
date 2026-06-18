import { cache } from "react";
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";

export const ACTIVE_HOUSEHOLD_COOKIE = "active_household_id";

/**
 * ログイン中ユーザーを取得する。
 *
 * `cache()` でラップしているため、同一リクエスト内で何度呼んでも
 * `auth.getUser()` の往復は一度きりに集約される。
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * グループの期間設定（`period_start_day`）を取得する。
 *
 * 複数ページで都度取得していた静的設定値を、`cache()` でリクエスト内一度に集約する。
 * グループが見つからない場合は既定値 1 を返す。
 */
export const getHouseholdSettings = cache(
  async (householdId: string): Promise<{ periodStartDay: number }> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("households")
      .select("period_start_day")
      .eq("id", householdId)
      .maybeSingle();
    return { periodStartDay: data?.period_start_day ?? 1 };
  },
);

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
export const getActiveHouseholdId = cache(async (): Promise<string | null> => {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(ACTIVE_HOUSEHOLD_COOKIE)?.value;

  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const supabase = await createClient();

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
});

/**
 * ログイン中ユーザーが所属する全グループを参加日時の昇順で返す。
 * ヘッダーのグループ・スイッチャー用。
 *
 * RLS は同居メンバー全員の行を返すため、必ず user_id で自分の所属行に絞る。
 */
export const getUserHouseholds = cache(
  async (): Promise<{ id: string; name: string }[]> => {
    const user = await getCurrentUser();
    if (!user) {
      return [];
    }

    const supabase = await createClient();
    const { data } = await supabase
      .from("household_members")
      .select("household:households(id, name)")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true })
      .overrideTypes<{ household: { id: string; name: string } | null }[]>();

    return (data ?? [])
      .map((row) => row.household)
      .filter((h): h is { id: string; name: string } => h !== null);
  },
);
