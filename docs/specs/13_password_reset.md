# パスワード再設定・パスワード変更 仕様書

## 概要

パスワードを忘れたユーザーが自力でログインできるようにする救済手段を追加する。
Supabase Auth の標準機能（`resetPasswordForEmail` / `updateUser`）を利用し、追加ライブラリや
独自トークンテーブルは導入しない。あわせてログイン中ユーザーが自分のパスワードを変更できる画面も追加する。

提供する機能:

1. **メール再設定フロー（未ログイン）**: ログイン画面 →「パスワードをお忘れですか？」→ メール送信 →
   メール内リンク → 新パスワード設定 → ログイン
2. **ログイン中のパスワード変更**: `/settings`（プロフィール設定）から自分のパスワードを変更

## 対象ユーザー・前提条件

- メール再設定: 未ログインユーザー（`(auth)` ルートグループ＝認証不要）
- パスワード変更: ログイン済みユーザー（`(dashboard)` ルートグループ＝認証必須）
- メール送信は Supabase 標準 SMTP を使用（送信レート制限ありだが、ポートフォリオ／デモ用途では十分）

### Supabase 側の設定（手動・1回のみ）

Authentication → URL Configuration で以下を設定する:

- **Site URL**: `http://localhost:3000`（本番は Vercel のデプロイ URL）
- **Redirect URLs** に `http://localhost:3000/auth/callback`（＋本番 URL の同パス）を追加

標準 PKCE フローでは「Reset Password」メールテンプレート（`{{ .ConfirmationURL }}`）が
`redirectTo` に対し `?code=...` 付きでリダイレクトするため、テンプレートの編集は不要。

## 画面・UI

### メール再設定フロー

- `/forgot-password`: メールアドレス入力フォーム。送信後は列挙攻撃対策のため、
  アドレスの存在有無に関わらず「パスワード再設定用のメールを送信しました。メールをご確認ください」を
  `role="status"` で表示。`/login` へ戻るリンクあり
- `/auth/callback`: メール内リンクの着地点（GET ルートハンドラ、画面なし）。
  `code` を `exchangeCodeForSession` でリカバリーセッションに交換し `/reset-password` へリダイレクト。
  失敗時は `/login?error=reset_link_invalid` へ
- `/reset-password`: 新パスワード＋確認の2入力フォーム。成功時 `/login?reset=success` へリダイレクト
- ログイン画面（`/login`）に「パスワードをお忘れですか？」リンクを追加（`/forgot-password` へ）

### パスワード変更（`/settings`）

- 既存「プロフィール設定」Card の下に「パスワード変更」Card を追加
- 新パスワード＋確認の2入力。成功時はリダイレクトせず `role="status"` で「パスワードを変更しました」を表示

### インタラクション・バリデーション

- メール: 形式チェック（`z.email`）
- パスワード: パスワードポリシー（**8文字以上＋英大文字・英小文字・数字・記号を各1文字以上**）を満たし、
  確認用と一致すること。入力欄の下に要件を補足表示（`PASSWORD_POLICY_HINT`）
  - ポリシーは登録・再設定・変更に適用。ログイン認証には適用しない（既存パスワードでログイン可能にするため）
- すべて Server Action（`useActionState`）。エラーは `role="alert"`、成功通知は `role="status"`
- 送信中はボタン disabled＋「処理中...」

## データモデル

### 入力

```typescript
// lib/validations/auth.ts
const resetRequestSchema = z.object({
  email: z.email("有効なメールアドレスを入力してください"),
});
// パスワードポリシー（登録・再設定・変更で共通）
const passwordPolicy = z
  .string()
  .min(8, PASSWORD_POLICY_MESSAGE)
  .regex(/[A-Z]/, PASSWORD_POLICY_MESSAGE)
  .regex(/[a-z]/, PASSWORD_POLICY_MESSAGE)
  .regex(/[0-9]/, PASSWORD_POLICY_MESSAGE)
  .regex(/[^A-Za-z0-9]/, PASSWORD_POLICY_MESSAGE);

const passwordUpdateSchema = z
  .object({
    password: passwordPolicy,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "パスワードが一致しません",
    path: ["confirmPassword"],
  });
```

### 出力

```typescript
// app/(auth)/actions.ts
type PasswordResetRequestState = { error: string } | { success: true } | undefined;
// updatePassword は成功時 redirect、失敗時 { error }（AuthState 流儀）

// app/(dashboard)/settings/actions.ts
type PasswordActionState = { error: string } | { success: true } | undefined;
```

## Supabase

### 使用テーブル

- `auth.users`（Supabase 管理）。アプリ側の追加テーブルなし

### クエリ / Server Action

```typescript
// app/(auth)/actions.ts
requestPasswordReset: supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${origin}/auth/callback?next=/reset-password`,
})
updatePassword:       supabase.auth.updateUser({ password })  // 成功後 signOut → /login

// app/auth/callback/route.ts
supabase.auth.exchangeCodeForSession(code)

// app/(dashboard)/settings/actions.ts
changePassword:       supabase.auth.updateUser({ password })
```

- サーバークライアント: `lib/supabase/server.ts#createClient`
- 公開パス判定: `lib/route-access.ts#isPublicPath`（`/forgot-password` `/reset-password` を追加）

## 未解決の課題

- 現在のパスワードによる再認証（reauthentication）はパスワード変更時に要求していない
  （セッション保有で十分とする。必要なら将来追加）
- メール本文の往復は実 inbox が必要なため E2E では検証できず、手動確認とする
- Supabase 標準 SMTP の送信レート制限により、短時間の連続送信は失敗しうる
