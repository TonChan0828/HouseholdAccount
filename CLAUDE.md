# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

家計簿（Household Account）アプリ。複数アカウントで家計簿グループを共有できるポートフォリオ用フルスタックWebアプリ。

## Tech Stack

- **Framework**: Next.js (App Router) + TypeScript
- **Backend/DB**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth（メール/パスワード）
- **Styling**: Tailwind CSS + shadcn/ui
- **Charts**: Recharts
- **Test**: Vitest + React Testing Library（Unit/Component）、Playwright（E2E）

## Commands

```bash
npm run dev           # 開発サーバー起動
npm run build         # プロダクションビルド
npm run lint          # ESLint
npm run typecheck     # TypeScript 型チェック（tsc --noEmit）

npm run test          # Vitest（ウォッチモード）
npm run test:run      # Vitest（CI向け1回実行）
npm run test:ui       # Vitest UI
npm run test:e2e      # Playwright E2E
npm run test:e2e:ui   # Playwright UI モード
```

## Repository Structure

```text
app/
  (auth)/               # ログイン・登録（認証不要ルート）
  (dashboard)/          # 認証済みルート（household_id コンテキスト必須）
    page.tsx            # ダッシュボード
    transactions/       # 収支一覧・追加・編集
    categories/         # カテゴリ管理
    analytics/          # 月次グラフ・カテゴリ別内訳（メンバー別切り替えあり）
    members/            # メンバー別アクティビティ
    household/          # グループ設定・メンバー管理
  households/           # 家計簿グループ選択画面（ログイン直後）
components/
  ui/                   # shadcn/ui（直接編集しない）
  features/             # transactions/ categories/ charts/ household/
lib/
  supabase/             # client.ts（ブラウザ用）/ server.ts（Server Component用）
  household.ts          # active_household_id 取得ヘルパー
  utils.ts
types/
  index.ts              # Transaction, Category, Household, Member など
e2e/                    # Playwright E2E テスト
docs/
  specs/                # 機能仕様書（実装前に作成する）
  sessions/             # セッションログ（YYYY-MM-DD_topic.md）
supabase/
  migrations/           # DB マイグレーション
```

Unit/Component テストはソースと同階層に配置する（例: `lib/utils.test.ts`）。

---

## Mandatory Rules

### Rule 1 — TDD（すべての実装に適用）

実装前に必ずテストを書く。

1. **Red**: 失敗するテストを書く
2. **Green**: テストが通る最小限の実装をする
3. **Refactor**: テストを壊さずコードを整理する

### Rule 2 — 機能仕様書（実装着手前に必須）

機能に着手する前に `/project:new-spec` を実行して `docs/specs/` に仕様書を作成・更新する。

仕様書に含める内容:

- 機能概要・目的
- データモデル（入出力の型）
- UI の動作・バリデーション
- Supabase テーブル・RLS ポリシー
- 未解決の課題

既存の仕様書:

```text
docs/specs/
  00_overview.md         # プロジェクト全体概要・画面遷移
  01_auth.md             # 認証（登録・ログイン・ログアウト）
  02_transactions.md     # 収支記録（CRUD）
  03_dashboard.md        # ダッシュボード
  04_categories.md       # カテゴリ管理
  05_analytics.md        # 月次分析・グラフ
  06_household.md        # 家計簿グループ管理
  07_member_activity.md  # メンバー別アクティビティ
  08_ui_overhaul.md      # UIオーバーホール（テーマ・アプリシェル・各ページ刷新）
  09_dark_mode.md        # ダークモード（テーマ切り替え）
  10_profile_settings.md # 表示名編集（プロフィール設定）
  11_security_hardening.md # セキュリティハードニング（認可の多層防御・ヘッダー）
```

### Rule 3 — セッションログ（セッション開始時に必須）

セッション開始時に `/project:new-session` でログを作成し、終了前に内容を更新する。

### Rule 4 — コミットメッセージ

形式: `<type>: <日本語の説明>`

| type | 用途 |
| --- | --- |
| `feat` | 新機能の追加 |
| `fix` | バグ修正 |
| `refactor` | 機能変更を伴わないコード整理 |
| `test` | テストの追加・修正 |
| `docs` | 仕様書・CLAUDE.md などドキュメントのみの変更 |
| `chore` | パッケージ追加・設定変更・ビルド関連 |
| `style` | フォーマット・スタイルのみの変更（ロジック変更なし） |

ルール:

- 説明は日本語で書く（命令形: 「〜を追加」「〜を修正」）
- 1コミット = 1つの変更目的（複数の目的を混在させない）
- 本文（body）は「なぜ変更したか」が自明でない場合にのみ追加する
- `feat` と `fix` 以外の type には `!` をつけない（破壊的変更がある場合のみ `feat!:` を使う）

例:

```text
feat: 収支登録フォームを追加
fix: household_id 未選択時にリダイレクトされない問題を修正
refactor: トランザクション取得ロジックをカスタムフックに分離
test: TransactionForm のバリデーションテストを追加
chore: shadcn/ui の Button コンポーネントを追加
docs: 収支記録の機能仕様書を作成
```

---

## Key Conventions

- **household スコープ（重要）**: `transactions`・`categories` の取得・更新は必ず `household_id` でスコープする。`user_id` 単体でのデータ取得は禁止。現在の `household_id` は `lib/household.ts` 経由で取得する
- Supabase クライアント: ブラウザ → `lib/supabase/client.ts`、Server Component → `lib/supabase/server.ts`
- 認証チェックは `middleware.ts` で一括管理し、`(auth)` グループは除外する
- Server Actions 優先。`/api` Route Handler は外部連携が必要な場合のみ使う
- shadcn/ui は `npx shadcn@latest add` で追加し、`components/ui/` を直接編集しない
- DB スキーマ変更は `supabase/migrations/` でマイグレーション管理する

## Database Schema

主要テーブル:

- `households` — id, name, created_by, created_at
- `household_members` — id, household_id, user_id, role(`owner`/`member`), joined_at
- `transactions` — id, household_id, created_by, amount, type(`income`/`expense`), category_id, date, memo, created_at
- `categories` — id, household_id, name, color, icon, type(`income`/`expense`/`both`), is_default

RLS ポリシー:

- 全テーブル: `household_members` に自分の `user_id` が存在する `household_id` のデータのみ操作可能
- `households` の削除・メンバー招待: `role = 'owner'` のみ
- `transactions` の編集・削除: `created_by = auth.uid()` のみ

## Features

1. **家計簿グループ管理**: 作成・メール招待・参加グループの切り替え
2. **収支記録**: 日付・金額・カテゴリ・メモ（登録者を自動記録）
3. **ダッシュボード**: 月次サマリー + 最近の取引（メンバー別フィルター付き）
4. **メンバー別アクティビティ**: 各メンバーが登録した収支を個別表示・集計
5. **月次分析**: 月別推移グラフ + カテゴリ別円グラフ（メンバー別切り替え）
6. **カテゴリ管理**: デフォルト + グループ共有カスタムカテゴリ
