# 認証メールテンプレート（Shallet ブランド化） 仕様書

## 概要

Supabase Auth が送信する認証メール（登録確認・パスワード再設定・メールアドレス変更）の
本文を、デフォルトの英語テンプレートからアプリ「Shallet」のブランドに合わせた日本語の
HTML メールへ差し替える。テンプレートは `supabase/templates/` でリポジトリ管理し、
`supabase/config.toml` の `[auth.email.template.*]` で件名とともに参照する。

対象テンプレート（Supabase 上のキー）:

1. **`confirmation`**（Confirm signup）— 新規登録時の確認メール。`signUp` /
   `resendConfirmation` で送信（[`23_email_verification.md`](./23_email_verification.md)）
2. **`recovery`**（Reset password）— パスワード再設定メール。`requestPasswordReset` ＝
   `resetPasswordForEmail` で送信（[`13_password_reset.md`](./13_password_reset.md)）
3. **`email_change`**（Change email）— メールアドレス変更の確認メール。現状アプリに導線は
   無いが、将来の設定画面追加に備えてブランド化テンプレートを整備しておく

## 前提・制約

- **リンク機構は変更しない**: すべてのテンプレートのアクションリンクは Supabase 変数
  **`{{ .ConfirmationURL }}`** を使う。これは PKCE フローで Supabase の verify エンドポイントを
  経由し、`emailRedirectTo` / `redirectTo` で指定した `/auth/callback?next=...` に
  `code` 付きで着地する（`app/auth/callback/route.ts` が `exchangeCodeForSession`）。
  リンクの生成方法は触らず、見た目（レイアウト・文言・配色）のみブランド化する
- メール送信は Supabase 標準 SMTP を使用（ポートフォリオ／デモ用途では十分）
- HTML はメールクライアント互換性のためインライン CSS ＋ table レイアウトで記述する
  （`<style>` や flex/grid は Gmail 等で無視されうるため使わない）

## デザイン

`app/globals.css` のライトテーマ・トークンに準拠する。

| 用途 | 値（近似 HEX） | 由来トークン |
| --- | --- | --- |
| 背景（クリーム） | `#f7f4ea` | `--background` oklch(0.976 0.013 85) |
| カード | `#ffffff` | 純白カード |
| primary（深いグリーン・CTAボタン） | `#2f7d57` | `--primary` oklch(0.46 0.09 155) |
| primary 文字 | `#ffffff` | `--primary-foreground` |
| 本文テキスト | `#1f2a24` | 深いグリーングレー |
| サブテキスト | `#6b7763` | `--muted-foreground` 相当 |
| 罫線 | `#e6e2d6` | クリーム系ボーダー |

- ヘッダーにワードマーク「Shallet」（深いグリーン）を表示
- 中央に角丸のカード、見出し → 説明文 → CTA ボタン → 補足（リンク失効・心当たりが無い場合）
- フッターにアプリ名と「家計を、みんなで一緒に。」のタグライン

## テンプレート別の文言

### confirmation（登録確認）
- 件名: `【Shallet】メールアドレスの確認をお願いします`
- 見出し: 「ようこそ、Shallet へ」
- 本文: 登録ありがとうございます。下のボタンでメールアドレスを確認すると登録が完了します。
- ボタン: 「メールアドレスを確認する」
- 補足: 心当たりが無い場合はこのメールを破棄してください。

### recovery（パスワード再設定）
- 件名: `【Shallet】パスワード再設定のご案内`
- 見出し: 「パスワードの再設定」
- 本文: パスワード再設定のリクエストを受け付けました。下のボタンから新しいパスワードを設定してください。
- ボタン: 「パスワードを再設定する」
- 補足: 心当たりが無い場合は操作不要です。パスワードは変更されません。

### email_change（メールアドレス変更）
- 件名: `【Shallet】メールアドレス変更の確認`
- 見出し: 「メールアドレスの変更」
- 本文: メールアドレス変更のリクエストを受け付けました。下のボタンで新しいアドレスを確認してください。
- ボタン: 「新しいメールアドレスを確認する」
- 補足: 心当たりが無い場合は操作不要です。

## 適用方法（Supabase への反映）

テンプレートはリポジトリ管理（`supabase/config.toml` ＋ `supabase/templates/*.html`）。

### ⚠️ 現状は未適用（カスタム SMTP が前提・2026-06-25 検証）

**標準メールプロバイダ（フリープラン）のままでは、テンプレート変更は API・ダッシュボード
いずれの経路でも不可**であることを確認した。適用にはカスタム SMTP プロバイダの設定が必要。

- `supabase config push` 経由:
  `400: Email template modification is not available for free tier projects using the
  default email provider. Please upgrade your plan or configure a custom SMTP provider.`
- ダッシュボード（Authentication → Emails）経由: 同様に編集がロックされ、カスタム SMTP 設定を促される

そのため本テンプレートは **適用待ちの資産** として整備のみ行い、反映は SMTP 導入後に実施する。

### SMTP 導入後の反映手順

1. Authentication → SMTP Settings でカスタム SMTP（Brevo / Resend / SendGrid 等）を設定
2. Authentication → Emails → 各テンプレート（Confirm signup / Reset password / Change email）に
   `supabase/templates/*.html` の内容を貼り付け、`config.toml` の `subject` を件名に設定する

### `supabase config push` を使わない理由

カスタム SMTP 導入後も `config push` は避ける。`[auth]` 設定全体をリモートへ上書きし、
`config.toml` に書いていない項目は CLI デフォルトに戻るため。実際の push 差分で MFA TOTP の
無効化（`enroll/verify true→false`）・メール送信レート緩和（`max_frequency 1m0s→1s`）・
`otp_length 8→6` 等の意図しない巻き込みを確認した（確認プロンプト無しで即適用）。
よって `config.toml` はテンプレ内容・件名の単一情報源（控え）に限定し、反映はダッシュボードで行う。

## テスト

- `supabase/templates/templates.test.ts`（Vitest）でガード:
  - 各テンプレートがアクションリンク変数 `{{ .ConfirmationURL }}` を含む（リンク機構の保全）
  - 各テンプレートに「Shallet」ブランド名が含まれる
  - デフォルト英語テンプレートの残骸（`Confirm your mail` 等）が無い

## 未解決の課題

- **テンプレート未適用**: カスタム SMTP 未導入のため、本テンプレートは本番未反映。
  SMTP 導入時に「SMTP 導入後の反映手順」を実施する（フリープランでは標準プロバイダのまま
  適用不可なことを 2026-06-25 に確認）
- `email_change` を実際に使う設定変更画面の導線は未実装（本仕様はテンプレート整備のみ）
