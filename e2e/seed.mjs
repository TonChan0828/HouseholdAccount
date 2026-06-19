// E2E フィクスチャを Supabase に作成する（冪等）。
//
// 東京リージョンへのプロジェクト作り直しで seed ユーザーが移行されなかったため、
// authed な E2E を回すのに必要な以下を再作成する:
//   - E2E_USER（e2e@e2etest.dev, owner）
//   - E2E_MEMBER_USER（e2e-member@e2etest.dev, display_name="テストメンバー", member）
//   - MULTI_MEMBER_HOUSEHOLD（両者が所属する2人グループ。owner=E2E_USER）
//
// auth ユーザーは Admin API 経由で作成する（パスワードのハッシュ化・identities を
// GoTrue に任せ、auth スキーマを手書きしない）。households への INSERT は
// handle_new_household トリガで owner メンバー + デフォルトカテゴリ12件を生成する。
// profiles は handle_new_user トリガで自動生成される（display_name は後段で補正）。
//
// 実行: node e2e/seed.mjs  （.env.local の service_role キーを使う）

import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  throw new Error(
    "seed には NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です（.env.local）。",
  );
}

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PASSWORD = "password123";
const OWNER_EMAIL = "e2e@e2etest.dev";
const MEMBER_EMAIL = "e2e-member@e2etest.dev";
const MEMBER_DISPLAY_NAME = "テストメンバー";
const HOUSEHOLD_NAME = "E2Eダッシュボード-1781044939636";

/** メールから既存 auth ユーザーを探す（admin.listUsers をページングして検索）。 */
async function findUserByEmail(email) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(`listUsers 失敗: ${error.message}`);
    const found = data.users.find((u) => u.email === email);
    if (found) return found;
    if (data.users.length < 200) return null;
  }
  return null;
}

/** メールアドレスの確認済みユーザーを作成し、存在すればパスワードを揃える（冪等）。 */
async function ensureUser(email) {
  const existing = await findUserByEmail(email);
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      password: PASSWORD,
      email_confirm: true,
    });
    console.log(`[seed] 既存ユーザーを更新: ${email} (${existing.id})`);
    return existing.id;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser 失敗(${email}): ${error.message}`);
  console.log(`[seed] ユーザーを作成: ${email} (${data.user.id})`);
  return data.user.id;
}

async function main() {
  const ownerId = await ensureUser(OWNER_EMAIL);
  const memberId = await ensureUser(MEMBER_EMAIL);

  // member の表示名を補正（トリガ既定は "e2e-member"）。
  const { error: profileErr } = await admin
    .from("profiles")
    .update({ display_name: MEMBER_DISPLAY_NAME })
    .eq("id", memberId);
  if (profileErr) throw new Error(`profiles 更新失敗: ${profileErr.message}`);

  // MULTI_MEMBER_HOUSEHOLD を取得 or 作成（名前で冪等判定）。
  const { data: existingHh, error: hhSelErr } = await admin
    .from("households")
    .select("id, created_by")
    .eq("name", HOUSEHOLD_NAME)
    .maybeSingle();
  if (hhSelErr) throw new Error(`households 取得失敗: ${hhSelErr.message}`);

  let householdId = existingHh?.id;
  if (!householdId) {
    // INSERT トリガが owner メンバー + デフォルトカテゴリ12件を生成する。
    const { data: created, error: hhInsErr } = await admin
      .from("households")
      .insert({ name: HOUSEHOLD_NAME, created_by: ownerId })
      .select("id")
      .single();
    if (hhInsErr) throw new Error(`households 作成失敗: ${hhInsErr.message}`);
    householdId = created.id;
    console.log(`[seed] グループを作成: ${HOUSEHOLD_NAME} (${householdId})`);
  } else {
    console.log(`[seed] 既存グループを使用: ${HOUSEHOLD_NAME} (${householdId})`);
  }

  // member の所属を保証（owner はトリガで登録済み）。
  const { data: membership, error: memSelErr } = await admin
    .from("household_members")
    .select("id")
    .eq("household_id", householdId)
    .eq("user_id", memberId)
    .maybeSingle();
  if (memSelErr) throw new Error(`membership 取得失敗: ${memSelErr.message}`);
  if (!membership) {
    const { error: memInsErr } = await admin
      .from("household_members")
      .insert({ household_id: householdId, user_id: memberId, role: "member" });
    if (memInsErr) throw new Error(`membership 作成失敗: ${memInsErr.message}`);
    console.log(`[seed] member を追加: ${MEMBER_EMAIL}`);
  }

  console.log("[seed] 完了");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
