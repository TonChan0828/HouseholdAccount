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
/register ──登録──┐
/login ──ログイン──┤
                  ▼
            /households（グループ選択・作成）  ← ログイン直後の着地点
                  │ グループ選択
                  ▼
          (dashboard) 認証必須ルート群
            /dashboard       … ダッシュボード（月次サマリー＋最近の取引）
            /transactions    … 収支一覧・追加・編集・CSV出力・インポート
            /categories      … カテゴリ管理
            /analytics       … 月次グラフ・カテゴリ別内訳
            /members         … メンバー別アクティビティ
            /settings        … アカウント設定（表示名・パスワード変更・退会）
            /help            … ヘルプ（各画面の操作ガイド）
          /households        … グループ選択・管理（作成/招待/メンバー/削除）
          /                  … ランディングページ（公開トップ）
```

### ルートグループ

- `(auth)`: `/login`, `/register`（認証不要。ログイン済みなら `/households` へ）
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

型は `types/database.ts`（スキーマ対応）と `types/index.ts`（ドメイン型）に定義。

## Supabase

### 使用テーブル

`households`, `household_members`, `categories`, `transactions`

### RLS ポリシー

全テーブルで RLS を有効化。所属グループのデータのみ操作可。詳細は 06_household.md。

### クエリ / Server Action

- 認証: `app/(auth)/actions.ts`（`signIn` / `signUp` / `signOut`）
- クライアント生成: `lib/supabase/client.ts`（ブラウザ）/ `lib/supabase/server.ts`（サーバー）
- アクティブグループ取得: `lib/household.ts#getActiveHouseholdId`

## 未解決の課題

- メール確認フロー（Supabase の email confirmation 設定に依存）
- 本番デプロイ（Vercel）
