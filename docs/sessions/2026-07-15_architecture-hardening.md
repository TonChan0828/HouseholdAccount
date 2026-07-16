# 2026-07-15 — アーキテクチャ・データ境界強化

## 目的

- 現行設計レビューで判明した RLS、データ整合性、定期収支生成、障害処理、CI の課題を
  既存互換を維持して段階的に修正する。

## やること

- DB 制約・RLS・定期収支一括生成 RPC
- 認証付き Vercel Cron
- クエリエラー処理・大量データ対応・エラー境界
- metadata / CI / 開発ドキュメント更新
- Unit / typecheck / lint / build / E2E の全検証

## 実施結果

- `0023_architecture_hardening.sql` を追加
  - 取引・定期収支の UPDATE/DELETE を登録者本人かつ現メンバーへ強化
  - カテゴリ参照を household 複合 FK に一本化し、既存の削除動作を維持
  - 金額・メモ長・貯金目標の DB CHECK を追加
  - 脱退者の定期収支を自動停止する trigger を追加
  - service-role 専用 `generate_all_due_recurring(date)` を追加
- Vercel Cron と `CRON_SECRET` 認証 Route Handler を追加し、東京日付で毎日生成
- Server Component の閲覧時生成を撤去
- 期間取引を1,000件単位で全件取得し、一覧表示を50件単位にページング
- Supabase 取得障害を `DataAccessError` として扱い、ダッシュボードエラー境界を追加
- ダッシュボード取得処理を `loadDashboardData` に分離
- 存在しない編集対象を 404 表示へ変更
- `metadataBase`、GitHub Actions（通常CI / DB / E2E）、任意 E2E ポートを追加
- クリーンなローカル Supabase を作れなかった既存 migration 0011 を存在確認付きに修正
- `server-only` を追加し、npm audit で検出された `hono` / `undici` を互換更新

## 検証

- DB: 全 migration のクリーン適用成功、pgTAP 16件成功
- Vitest: 106 files / 669 tests 成功
- TypeScript / ESLint: 成功（警告なし）
- Production build: 成功（metadataBase 警告解消）
- Playwright: 58 tests、`--workers=1` で成功
- npm audit: 0 vulnerabilities

## 決めたこと・理由

- 単一 category FK と複合 FK の併存は PostgREST の埋め込み関係を曖昧にするため、
  household 複合 FK へ一本化した。取引・定期収支は category_id のみ SET NULL、予算は
  CASCADE とし既存動作を維持した。
- E2E は別プロジェクトが port 3000 を使用していても実行できるよう `E2E_PORT` に対応した。
- Vercel Cron は UTC のため、Route Handler で Asia/Tokyo の日付へ変換して RPC に渡す。

## デプロイ時に必要なこと

- Supabase migration 0023 を適用する。
- Vercel に `SUPABASE_SERVICE_ROLE_KEY`、`CRON_SECRET`、`NEXT_PUBLIC_APP_URL` を設定する。
