# Shallet

**家計を、みんなで一緒に。**

Shallet（シャレット）は、家族やパートナーと家計簿グループを共有できるフルスタック Web 家計簿アプリです。名前は `share`（共有）＋ `wallet`（財布）の造語で、「みんなの財布を一つにまとめる」というコンセプトを表しています。ポートフォリオ用に開発しています。

## 主な機能

- **家計簿グループ管理** — グループの作成・メール招待・参加グループの切り替え
- **収支記録** — 日付・金額・カテゴリ・メモを登録（登録者を自動記録）
- **ダッシュボード** — 月次サマリーと当期収支グラフ、最近の取引（メンバー別フィルター付き）
- **メンバー別アクティビティ** — 各メンバーが登録した収支を個別表示・集計
- **月次分析** — 月別推移グラフ＋カテゴリ別円グラフ（メンバー別切り替え）
- **カテゴリ管理** — デフォルト＋グループ共有のカスタムカテゴリ
- **ダークモード・プロフィール設定・セキュリティハードニング** ほか

## 技術スタック

- **フレームワーク**: Next.js (App Router) + TypeScript
- **バックエンド / DB**: Supabase (PostgreSQL)
- **認証**: Supabase Auth（メール / パスワード）
- **スタイリング**: Tailwind CSS + shadcn/ui
- **グラフ**: Recharts
- **テスト**: Vitest + React Testing Library（Unit / Component）、Playwright（E2E）

## セットアップ

```bash
npm install           # 依存パッケージのインストール
npm run dev           # 開発サーバー起動（http://localhost:3000）
```

`.env.local` に以下を設定してください。

```dotenv
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=... # アクセス回数制限 / Cron / E2E用。ブラウザへ公開しない
RATE_LIMIT_SECRET=...         # 32バイト以上のランダム値。openssl rand -base64 32 で生成
CRON_SECRET=...               # 16文字以上のランダム値
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

本番は `RATE_LIMIT_SECRET` と回数制限用のSupabase設定を起動時に検査します。設定不足の場合は起動を中止します。

収支一覧のデータベース集計には `20261005120000_0032_transaction_summary.sql` の適用が必要です。本番では専用ホストがアプリの公開前にマイグレーションを適用します。

本番では `NEXT_PUBLIC_APP_URL` を公開URLへ変更してください。定期収支は
Vercel Cron から毎日 `/api/cron/recurring` を呼び出して生成します。

## コマンド

```bash
npm run dev           # 開発サーバー起動
npm run build         # プロダクションビルド
npm run lint          # ESLint
npm run typecheck     # TypeScript 型チェック

npm run test          # Vitest（ウォッチモード）
npm run test:run      # Vitest（CI 向け 1 回実行）
npm run test:e2e      # Playwright E2E
```

## CI（変更の自動検証）

プルリクエストと `main` への push で、GitHub Actions が次のチェックを実行します。

| チェック | 内容 |
| --- | --- |
| `CI / verify` | ワークフローの構文と式、依存関係、ESLint（警告も失敗）、Next.js のルート型を含む型検査、本番ビルドを検証します。依存パッケージに重大度が High 以上の脆弱性がある場合も失敗します。 |
| `CI / coverage` | 単体テストを実行し、全体のカバレッジ下限を検証します。 |
| `CI / accessibility` | 公開画面のアクセシビリティを検証します。 |
| `Database / test` | CI 内の Supabase にマイグレーションを適用し、生成した DB 型と、SQL テスト・精算結果を検証します。 |
| `E2E / playwright` | ブラウザーテストを12分割して並列実行します。本番ビルドを使った取込プレビューの確認も並列で実行します。 |

本番公開にはリリース専用ホストを使います。[本番公開とマイグレーション](docs/specs/39_architecture_hardening.md#本番公開とマイグレーション)に設定と復旧手順を記載しています。

カバレッジ、アクセシビリティ、E2E のテストが失敗した場合は、該当ジョブのレポートを GitHub Actions の実行画面からダウンロードできます。保存期間は7日間です。
ミューテーションテストはコードを意図的に変えて既存テストが失敗するかを確認します。毎日03:00（日本時間）と手動実行で検証します。
プルリクエストに追加のコミットを push すると、CI・データベース・ブラウザーの検証は進行中の旧コミットの実行を取り消します。

## ドキュメント

- 機能仕様書: [`docs/specs/`](docs/specs/)
- 開発ガイド（Claude Code 向け）: [`CLAUDE.md`](CLAUDE.md)

DB のスキーマを変更したら Supabase CLI 2.117.0 でローカル DB を起動し、`npm run db:types` で `types/database.ts` を更新してください。
