/** ログイン済みセッションを保存するファイル */
export const STORAGE_STATE = "e2e/.auth/user.json";

/** E2E 用の確認済みテストユーザー（Supabase に seed 済み。MULTI_MEMBER_HOUSEHOLD のオーナー） */
export const E2E_USER = {
  email: "e2e@e2etest.dev",
  password: "password123",
};

/**
 * 2人目のテストメンバー（Supabase に seed 済み。display_name="テストメンバー"）。
 * MULTI_MEMBER_HOUSEHOLD に member として参加しており、オーナー視点での
 * 委譲・除外 UI や複数人テストに使う。
 */
export const E2E_MEMBER_USER = {
  email: "e2e-member@e2etest.dev",
  password: "password123",
  displayName: "テストメンバー",
};

/**
 * E2E ユーザーが所属する2人メンバーのグループ（Supabase に seed 済み）。
 * メンバー: E2E_USER（owner）+ E2E_MEMBER_USER（member）。
 * 複数メンバーのグループでの重複表示・切り替え・メンバー管理 UI の回帰テストに使う。
 */
export const MULTI_MEMBER_HOUSEHOLD = "E2Eダッシュボード-1781044939636";
