/** ログイン済みセッションを保存するファイル */
export const STORAGE_STATE = "e2e/.auth/user.json";

/**
 * E2E が生成する一時データ（グループ等）に付与する接頭辞。
 * クリーンアップ（global-setup）の識別子を兼ねる。seed 済みフィクスチャは
 * この接頭辞を持たないため、クリーンアップ対象から自動的に除外される。
 */
export const E2E_EPHEMERAL_PREFIX = "__e2e_tmp_";

/**
 * クリーンアップ対象として識別できる一時データ名を生成する。
 * 例: ephemeralName("分析") => "__e2e_tmp_分析-1718600000000"
 */
export function ephemeralName(label: string): string {
  return `${E2E_EPHEMERAL_PREFIX}${label}-${Date.now()}`;
}

/**
 * 名前が E2E の一時データ（クリーンアップ対象）かどうかを判定する。
 * global-setup の SQL `name LIKE '<prefix>%'` と同じ規約。
 */
export function isEphemeralName(name: string): boolean {
  return name.startsWith(E2E_EPHEMERAL_PREFIX);
}

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
