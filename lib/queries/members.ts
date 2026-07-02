import { cache } from "react";

import type { MemberInfo } from "@/lib/members";
import { createClient } from "@/lib/supabase/server";

/**
 * グループの全メンバーを、解決済みの表示名付き・参加日時の昇順で返す。
 *
 * 表示名はグループ毎の名前（household_members.display_name）を優先し、
 * 未設定ならグローバル名（profiles.display_name）、それも無ければ
 * 「不明なユーザー」にフォールバックする（spec 22 の単一実装点）。
 * `cache()` でリクエスト内の重複呼び出しを一度に集約する。
 */
export const getHouseholdMemberNames = cache(
  async (householdId: string): Promise<MemberInfo[]> => {
    const supabase = await createClient();

    const { data: memberRows } = await supabase
      .from("household_members")
      .select("user_id, display_name")
      .eq("household_id", householdId)
      .order("joined_at");
    const members = memberRows ?? [];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", members.map((m) => m.user_id));
    const globalNameById = new Map(
      (profiles ?? []).map((p) => [p.id, p.display_name]),
    );

    return members.map((m) => ({
      user_id: m.user_id,
      display_name:
        m.display_name ?? globalNameById.get(m.user_id) ?? "不明なユーザー",
    }));
  },
);
