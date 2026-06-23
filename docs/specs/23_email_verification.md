# メール認証（登録後の確認案内ページ） 仕様書

## 概要

新規登録（サインアップ）時に Supabase Auth のメール確認（email confirmation）を必須化し、
登録直後に「確認メールを送信しました」と案内する専用ページを追加する。メール内リンクは
既存の `app/auth/callback/route.ts` で着地させ、確認完了後は `/households` へ送る。
案内ページには確認メールの再送信ボタンを置く。

これまで登録は成功直後に `/households` へリダイレクトしており、メール確認が無効である前提の
実装だった（[`01_auth.md`](./01_auth.md) の旧「未解決の課題」）。本仕様でその分岐を実装する。

提供する機能:

1. **確認案内ページ（未ログイン）**: 登録 → `/verify-email` → メール内リンク →
   `/auth/callback`（code 交換）→ `/households`
2. **確認メールの再送信**: 案内ページのボタンから `supabase.auth.resend` で再送信

## 対象ユーザー・前提条件

- 未ログインユーザー（`(auth)` ルートグループ＝認証不要）
- メール送信は Supabase 標準 SMTP を使用（ポートフォリオ／デモ用途では十分）
- **メール確認を ON にすると、確認前ユーザーはログインできない**

### Supabase 側の設定（手動・1回のみ）

- Authentication → Sign In / Providers → Email の **「Confirm email」を ON**
- Authentication → URL Configuration の **Site URL / Redirect URLs** に
  `http://localhost:3000/auth/callback`（＋本番 URL の同パス）を含める（パスワード再設定と共通）
- `NEXT_PUBLIC_SITE_URL`（本番 URL）を設定。未設定時は request origin にフォールバック

## 画面・UI

- `/register`: 既存の登録フォーム。送信成功後は `/verify-email?email=<入力アドレス>` へリダイレクト
- `/verify-email`: 確認案内ページ。`email` クエリ宛に「確認メールを送信しました。メール内のリンクを
  クリックして登録を完了してください」と表示。**確認メールを再送信**ボタンと `/login` へ戻るリンクを置く
  - 再送信ボタンは client component（`components/features/auth/resend-confirmation.tsx`）。
    送信後は `role="status"` で「確認メールを再送信しました」を表示
- `/auth/callback`: メール内リンクの着地点（GET ルートハンドラ、画面なし）。`code` を
  `exchangeCodeForSession` でセッションに交換し `next`（確認は `/households`）へリダイレクト。
  失敗時は `/login?error=reset_link_invalid` へ（パスワード再設定と共用）

### インタラクション・バリデーション

- メール列挙対策: 確認有効時 Supabase は既存ユーザーでもエラーを返さないため、登録は分岐せず
  常に案内ページへ送る。再送信も結果に関わらず `success` を返す
- すべて Server Action（`useActionState`）。成功通知は `role="status"`

## データモデル

### 入力

```typescript
// lib/validations/auth.ts
// 既存の resetRequestSchema（email のみ）を再送信にも再利用する
const resetRequestSchema = z.object({
  email: z.email("有効なメールアドレスを入力してください"),
});
```

### 出力

```typescript
// app/(auth)/actions.ts
type AuthState = { error: string } | undefined;                 // signUp（成功時 redirect）
type ResendConfirmationState = { success: true } | { error: string } | undefined; // resendConfirmation
```

## Supabase

### 使用テーブル

- `auth.users`（Supabase 管理）。アプリ側の追加テーブルなし

### クエリ / Server Action

```typescript
// app/(auth)/actions.ts
signUp: supabase.auth.signUp({
  email,
  password,
  options: { emailRedirectTo: `${origin}/auth/callback?next=/households` },
}) // 成功後 /verify-email?email=... へ redirect

resendConfirmation: supabase.auth.resend({
  type: "signup",
  email,
  options: { emailRedirectTo: `${origin}/auth/callback?next=/households` },
}) // 結果に関わらず { success: true }

// app/auth/callback/route.ts
supabase.auth.exchangeCodeForSession(code) // パスワード再設定と共用
```

- サーバークライアント: `lib/supabase/server.ts#createClient`
- origin 解決: `process.env.NEXT_PUBLIC_SITE_URL ?? headers().get("origin")`（`requestPasswordReset` と共通）
- 公開パス判定: `lib/route-access.ts#isPublicPath`（`/verify-email` を追加）

## 未解決の課題

- メール本文の往復は実 inbox が必要なため E2E では検証できず、手動確認とする
- Supabase 標準 SMTP の送信レート制限により、短時間の連続再送信は失敗しうる
- 確認前ユーザーの再ログイン導線（未確認のまま `/login` した場合の案内）は今後の検討事項
