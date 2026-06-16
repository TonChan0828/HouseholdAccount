# 2026-06-16 — アカウント削除機能

## やったこと

- 仕様書 `docs/specs/14_account_deletion.md` を作成、CLAUDE.md の一覧に追記（13 も追記）
- 実装プラン（plan モード）: `/Users/show/.claude/plans/pure-noodling-adleman.md`
- マイグレーション `supabase/migrations/0012_delete_own_account.sql` を追加し本番に適用
  - SECURITY DEFINER 関数 `public.delete_own_account()`（オーナー委譲＋`delete from auth.users`）
  - 既定権限で残る anon の EXECUTE も明示 revoke（0007 と同方針）。types を再生成し `types/database.ts` に反映
- Server Action `deleteAccount`（`app/(dashboard)/settings/actions.ts`）を TDD で追加
  - 確認フレーズ=登録メール一致・RPC 呼び出し・signOut→`/login?deleted=1`。バリデーション `lib/validations/account.ts`
- `AccountDeletionForm`（`components/features/profile/`）を TDD で追加し設定ページに3枚目の Card として統合
- `AuthForm` に `notice` prop を追加し、`/login?deleted=1` で「アカウントを削除しました」を表示
- 検証: typecheck / lint / `test:run`（45 files・197 tests）すべて PASS
  - DB 検証: トランザクション内でログインを偽装し `delete_own_account` を実行→ROLLBACK で確認。
    共有グループ存続・`created_by`=B・B が owner・A 退会・A 単独グループは CASCADE 削除、をすべて確認（残置データなし）
  - `get_advisors(security)`: `delete_own_account` の SECURITY DEFINER WARN は既存ヘルパー6件と同種で意図的（auth.uid() 限定）

## 決めたこと・理由

- **削除手段は SECURITY DEFINER の RPC `delete_own_account()`**: service-role キーをアプリに持ち込まず、
  既存 SECURITY DEFINER ヘルパー（`is_household_owner` 等）と同じ流儀で auth.users を自己削除する。
- **オーナー委譲**: 全 FK が `ON DELETE CASCADE`。本人が作成者のグループに他メンバーが残る場合は、
  最古参メンバーへオーナー委譲（`role` 昇格＋`households.created_by` 張り替え）してグループと共有データを存続させる。
  本人だけのグループは CASCADE 削除。
- **確認フレーズ＝登録メールアドレス入力**: 一致するまで削除ボタン無効。誤操作防止。

## 次にやること

- `feature/account-deletion` を main へ統合（PR）
- ブラウザでの手動確認（設定→確認フレーズ入力→削除→`/login` 通知）

## 未解決の課題

- 再認証（パスワード再入力）は要求しない方針
- ソフトデリート・監査ログは設けない
- 破壊的 E2E（実アカウント削除）は共有 Supabase への影響を避け未追加。
  代わりに Unit＋DB シミュレーション（ROLLBACK）で多層検証した
