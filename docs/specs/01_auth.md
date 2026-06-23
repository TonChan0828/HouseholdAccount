# 認証（登録・ログイン・ログアウト） 仕様書

## 概要

Supabase Auth（メール/パスワード）による認証。登録・ログイン・ログアウトと、
未認証アクセスの保護（リダイレクト）を提供する。

## 対象ユーザー・前提条件

- 未登録ユーザーはメールアドレスとパスワードで新規登録できる
- 登録済みユーザーはログイン/ログアウトできる
- セッションは Cookie で保持し、`proxy.ts` がリクエストごとに更新する

## 画面・UI

### 表示内容

- `/login`: メール・パスワード入力フォーム、`/register` へのリンク
- `/register`: メール・パスワード入力フォーム、`/login` へのリンク
- 共通フォームは `components/features/auth/auth-form.tsx`

### インタラクション・バリデーション

- メール: 形式チェック（`z.email`）
- パスワード: ログインは6文字以上（`min(6)`、既存パスワード許容）。
  登録はパスワードポリシー（8文字以上＋英大・英小・数字・記号）を適用し、入力欄に要件を補足表示
  （[`13_password_reset.md`](./13_password_reset.md) 参照）
- 送信は Server Action（`useActionState`）。エラーはフォーム内に `role="alert"` で表示
- ログイン成功 → `/households` へリダイレクト
- 登録成功 → 確認メールを送信し `/verify-email` へ（[`23_email_verification.md`](./23_email_verification.md) 参照）
- ログアウト → `/login` へリダイレクト
- ログイン済みで `/login` `/register` にアクセス → `/households` へ

## データモデル

### 入力

```typescript
// lib/validations/auth.ts
const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
});
const registerSchema = z.object({
  email: z.email(),
  password: passwordPolicy, // 8文字以上＋英大・英小・数字・記号
});
```

### 出力

```typescript
// app/(auth)/actions.ts
type AuthState = { error: string } | undefined;
```

## Supabase

### 使用テーブル

- `auth.users`（Supabase 管理）

### RLS ポリシー

- 認証情報自体は Supabase Auth が管理（アプリ側テーブルなし）

### クエリ / Server Action

```typescript
// app/(auth)/actions.ts
signIn:  supabase.auth.signInWithPassword({ email, password })
signUp:  supabase.auth.signUp({ email, password })
signOut: supabase.auth.signOut()
```

- サーバークライアント: `lib/supabase/server.ts#createClient`
- セッション更新・保護: `lib/supabase/middleware.ts#updateSession`（`proxy.ts` から呼ぶ）

## 未解決の課題

- ソーシャルログインは未対応
- E2E のログイン/登録シナリオは実 Supabase 接続が必要（現状は未認証リダイレクトのみ）

> パスワード再設定・パスワード変更は [`13_password_reset.md`](./13_password_reset.md) を参照。
> 登録後のメール確認フローは [`23_email_verification.md`](./23_email_verification.md) を参照。
