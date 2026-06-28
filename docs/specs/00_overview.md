# プロジェクト全体概要 仕様書

## 概要

複数アカウントで家計簿グループ（household）を共有できるフルスタック家計簿アプリ。
ユーザーはグループを作成・招待し、グループ内の収支を共同で記録・集計・分析できる。

## 対象ユーザー・前提条件

- メール/パスワードで登録したログインユーザー
- すべての家計簿データは `household_id` でスコープされ、所属メンバーのみ閲覧・操作できる

## 画面・UI

### 画面遷移

```text
/                  … ランディングページ（公開トップ・未ログイン向け）
/demo/*            … デモモード（ログイン不要・インメモリ。dashboard/transactions/categories）

(auth) 認証不要ルート群
  /register ──登録──→ /verify-email（確認メール案内）──メール内リンク──┐
  /login ───ログイン────────────────────────────────────────────┤
  /forgot-password → /reset-password（パスワード再設定）              │
                                                                  ▼
            /households（グループ選択・作成・招待・メンバー・削除）  ← ログイン直後の着地点
                  │ グループ選択（Cookie active_household_id）
                  ▼
          (dashboard) 認証必須ルート群（household_id コンテキスト必須）
            /dashboard                  … ダッシュボード（月次サマリー＋予算進捗＋最近の取引）
            /transactions               … 収支一覧・追加・編集・削除・CSV出力・インポート
            /transactions/recurring     … 定期収支（固定費・固定収入の自動生成）
            /calendar                   … カレンダービュー（暦月で収支を俯瞰）
            /analytics                  … 月次グラフ・カテゴリ別内訳
            /budgets                    … 予算管理（予実）
            /members                    … メンバー別アクティビティ
            /categories                 … カテゴリ管理
            /settings                   … アカウント設定（表示名・パスワード変更・退会）
            /help                       … ヘルプ（各画面の操作ガイド）

/invite/[token]    … 招待リンク参加画面（認証必須）
/auth/callback     … メール内リンクの着地点（code 交換・画面なし）
```

### ルートグループ

- `(auth)`: `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`（認証不要。ログイン済みなら `/households` へ）
- 公開パス: `/`（LP・完全一致）, `/demo/*`, `/auth/*`（`lib/route-access.ts#isPublicPath`）
- `/households`: グループ選択（認証必須・グループ未選択でも可）
- `(dashboard)`: 上記以外。認証必須かつ `household_id` コンテキストを前提とする

### インタラクション・バリデーション

- 未認証で保護ルートにアクセス → `/login` へリダイレクト（proxy で一括制御）
- 認証は `proxy.ts`（旧 middleware）で集中管理し、`(auth)` グループは除外

## データモデル

詳細は各機能仕様書を参照。主要エンティティ:

- `Household` / `HouseholdMember` … 06_household.md
- `Transaction` … 02_transactions.md
- `Category` … 04_categories.md
- `RecurringTransaction` … 26_recurring_transactions.md
- `Budget` … 30_budget_management.md
- `Profile`（グローバル表示名） … 07_member_activity.md / 10_profile_settings.md

型は `types/database.ts`（スキーマ対応）と `types/index.ts`（ドメイン型）に定義。

## Supabase

### 使用テーブル

`households`, `household_members`, `categories`, `transactions`, `profiles`,
`household_invitations`, `recurring_transactions`, `budgets`

### RLS ポリシー

全テーブルで RLS を有効化。所属グループのデータのみ操作可。判定は `private` スキーマの
SECURITY DEFINER ヘルパー（`is_household_member` / `is_household_owner`）で行う（11_security_hardening.md）。
詳細は 06_household.md。

### クエリ / Server Action

- 認証: `app/(auth)/actions.ts`（`signIn` / `signUp` / `signOut` / `requestPasswordReset` / `updatePassword` / `resendConfirmation`）
- クライアント生成: `lib/supabase/client.ts`（ブラウザ）/ `lib/supabase/server.ts`（サーバー）
- アクティブグループ取得: `lib/household.ts#getActiveHouseholdId`（Cookie を所属検証してから返す多層防御）

## 未解決の課題

- 本番デプロイ（Vercel）
- 認証メールテンプレートの本番反映（カスタム SMTP 導入後・24_auth_email_templates.md）
