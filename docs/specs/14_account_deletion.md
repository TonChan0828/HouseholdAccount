# アカウント削除 仕様書

## 概要

ログイン中ユーザーが自分のアカウントを完全に削除（退会）できるようにする。
`/settings`（プロフィール設定）に「アカウント削除」セクションを追加し、確認フレーズ入力後に
アカウントと関連データを削除する。

`auth.users` の削除には昇格権限が必要だが、本アプリは anon キーのみで service-role クライアントを
持たない。そのため `SECURITY DEFINER` の Postgres 関数 `public.delete_own_account()` を追加し、
認証済みクライアントから RPC として呼び出す。service-role キーをアプリ環境に持ち込まない方針
（既存の `is_household_owner` 等 SECURITY DEFINER ヘルパーと同じ流儀。`0006_harden_function_grants.sql` 参照）。

## 対象ユーザー・前提条件

- ログイン済みユーザー（`(dashboard)` ルートグループ＝認証必須）
- `delete_own_account()` は `auth.uid()` の本人アカウントのみを対象とする（引数なし）

## データ影響（重要）

全 FK が `auth.users(id) ON DELETE CASCADE`（`0001_initial_schema.sql`）。素朴に `auth.users` を
削除すると、本人が `created_by` のグループ（`households.created_by`）も CASCADE で消え、
**他メンバーの共有データまで消滅する**。これを避けるためオーナー委譲を行う。

削除時の最終状態:

| 対象 | 挙動 |
| --- | --- |
| 本人が作成し、他メンバーが残るグループ | **存続**（最古参の別メンバーへオーナー委譲） |
| 本人だけのグループ | CASCADE 削除（グループ・カテゴリ・取引も消滅） |
| 本人の `household_members` 行 | CASCADE 削除（＝委譲後のグループからも離脱） |
| 本人が作成した `transactions` | CASCADE 削除（存続グループ内でも本人分は消去＝個人データ消去として許容） |
| 本人が作成した `household_invitations` | CASCADE 削除 |
| 本人の `profiles` 行 | CASCADE 削除 |

## RPC 仕様 — `public.delete_own_account()`

`SECURITY DEFINER` / `set search_path = public, auth` / 戻り値 `void`。

1. `auth.uid()` が NULL なら例外（未認証）。
2. `created_by = auth.uid()` のグループを走査。本人以外のメンバーが存在する場合のみ:
   - `household_members.joined_at` 最古の本人以外メンバーを選定。
   - そのメンバーの `role` を `owner` に更新。
   - `households.created_by` をそのメンバーの `user_id` に張り替え（CASCADE 対象から除外）。
3. `delete from auth.users where id = auth.uid();`（残りは CASCADE）。

権限: `revoke execute ... from public; grant execute ... to authenticated;`（0006 踏襲）。
関数オーナーが `auth.users` への DELETE 権限を持つこと（migration 適用ロール=postgres）を前提とする。

## 画面・UI

### `/settings`

- 「プロフィール設定」「パスワード変更」Card の下に **「アカウント削除」Card**（destructive 系見出し）を追加。
- 確認フレーズとして **登録メールアドレスの入力**を必須化。入力が `email` と一致するまで削除ボタンは無効。
- 削除ボタンは destructive スタイル。送信中は disabled＋「処理中...」。
- 失敗時は `role="alert"` でエラー表示（既存フォームと同じ流儀）。
- 削除成功時は `signOut()`（クッキー破棄）→ `/login?deleted=1` へリダイレクト。

### ログイン画面

- `/login?deleted=1` で「アカウントを削除しました」を `role="status"` で表示（`AuthForm` に `notice` prop 追加）。

## データモデル

### 入力 / 出力

```typescript
// app/(dashboard)/settings/actions.ts
type AccountDeletionState = { error: string } | undefined; // 成功時は redirect するため success なし

deleteAccount(prev, formData):
  // formData.confirmText === user.email を検証（不一致なら { error }）
  // supabase.rpc("delete_own_account") → 失敗なら { error }
  // 成功: supabase.auth.signOut()（失敗無視）→ redirect("/login?deleted=1")
```

確認フレーズは `email` 依存のため、空チェックのみ Zod（`lib/validations/account.ts`）で行い、
一致判定は action 内で `user.email` と比較する。

## Supabase

### 使用テーブル / 関数

- `auth.users`（Supabase 管理）、`households`、`household_members`（委譲で更新）
- `public.delete_own_account()`（新規 RPC、`0012_delete_own_account.sql`）
- サーバークライアント: `lib/supabase/server.ts#createClient`

## テスト

- Unit（`settings/actions.test.ts`）: 未認証→redirect / 確認フレーズ不一致→error / rpc エラー→error / 成功→signOut+redirect。
- Component（`account-deletion-form.test.tsx`）: 入力一致までボタン無効 / 送信で action 呼び出し / エラー表示。
- DB/E2E: オーナー委譲シナリオを SQL で確認、削除→`/login` 遷移を手動/Playwright で確認。

## 未解決の課題

- 削除前のパスワード/再認証は要求しない（セッション保有＋確認フレーズで十分とする）。
- 削除のアンドゥ・論理削除（ソフトデリート）は提供しない（物理削除のみ）。
- 監査ログ（削除記録のアーカイブ）は設けない。
