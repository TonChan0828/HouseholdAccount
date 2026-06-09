/** ログイン済みセッションを保存するファイル */
export const STORAGE_STATE = "e2e/.auth/user.json";

/** E2E 用の確認済みテストユーザー（Supabase に seed 済み） */
export const E2E_USER = {
  email: "e2e@e2etest.dev",
  password: "password123",
};
