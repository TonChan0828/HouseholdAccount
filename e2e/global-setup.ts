import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

import { isEphemeralName } from "./constants";

/**
 * E2E 実行の開始時に、前回までに残った一時データを掃除する。
 *
 * 各テストは衝突回避のため毎回新しいグループ等を作成するが、後始末をしないテストもあり
 * Supabase にゴミが蓄積する。終了後ではなく「開始時」に掃除することで、
 * 前回の実行が途中で落ちても次回の開始時に必ず回収できる（クラッシュ耐性）。
 *
 * 削除対象は接頭辞 E2E_EPHEMERAL_PREFIX を持つグループのみ。seed 済みフィクスチャは
 * 接頭辞を持たないため除外される（isEphemeralName で判定）。transactions / categories /
 * household_members は households への ON DELETE CASCADE で連鎖削除される。
 *
 * RLS をバイパスして全テストデータを消すため service-role キーを使う。
 * 仕様: docs/specs/18_e2e_data_lifecycle.md
 */
export default async function globalSetup() {
  // Playwright の Node プロセスは Next の env を自動で読まないため明示的に読み込む。
  loadEnvConfig(process.cwd());

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "E2E クリーンアップに NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です。" +
        ".env.local（または CI シークレット）に設定してください。",
    );
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // SQL の LIKE は `_` がワイルドカードになり誤マッチするため、取得して JS で厳密判定する。
  const { data, error } = await admin.from("households").select("id, name");
  if (error) {
    throw new Error(`E2E クリーンアップのグループ取得に失敗: ${error.message}`);
  }

  const targets = (data ?? []).filter((h) => isEphemeralName(h.name));
  if (targets.length === 0) {
    return;
  }

  const { error: deleteError } = await admin
    .from("households")
    .delete()
    .in(
      "id",
      targets.map((h) => h.id),
    );
  if (deleteError) {
    throw new Error(`E2E クリーンアップの削除に失敗: ${deleteError.message}`);
  }

  console.log(`[e2e] 一時グループを ${targets.length} 件クリーンアップしました`);
}
