/** ログイン済みセッションを保存するファイル */
export const STORAGE_STATE = "e2e/.auth/user.json";

/** E2E 用の確認済みテストユーザー（Supabase に seed 済み） */
export const E2E_USER = {
  email: "e2e@e2etest.dev",
  password: "password123",
};

/**
 * E2E ユーザーが所属する2人メンバーのグループ（Supabase に seed 済み）。
 * 複数メンバーのグループでの重複表示・切り替えの回帰テストに使う。
 */
export const MULTI_MEMBER_HOUSEHOLD = "E2Eダッシュボード-1781044939636";
