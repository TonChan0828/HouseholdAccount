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
SUPABASE_SERVICE_ROLE_KEY=... # Cron / E2E 管理処理専用。ブラウザへ公開しない
CRON_SECRET=...               # 16文字以上のランダム値
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

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

## ドキュメント

- 機能仕様書: [`docs/specs/`](docs/specs/)
- 開発ガイド（Claude Code 向け）: [`CLAUDE.md`](CLAUDE.md)
