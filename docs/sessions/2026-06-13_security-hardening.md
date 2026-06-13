# 2026-06-13 — セキュリティハードニング（デプロイ前のセキュリティ確認・改善）

## やったこと

- コードベース全体のセキュリティ調査（認証・認可、Server Actions、RLS、Cookie、ヘッダー）
- `getActiveHouseholdId` に Cookie の `active_household_id` のメンバーシップ検証を追加（TDD、`lib/household.test.ts` 新規）
- `setActiveHouseholdCookie` に本番環境のみ `secure` フラグを追加
- `updateTransaction` / `deleteTransaction` に認証チェック + `household_id` スコープを追加（TDD、`app/(dashboard)/transactions/actions.test.ts` 新規）。更新対象が見つからない場合はエラーを返す
- `next.config.ts` にセキュリティヘッダーを設定（X-Frame-Options / X-Content-Type-Options / Referrer-Policy / Permissions-Policy）→ curl で付与を確認
- Supabase security advisors を実行し、`rls_auto_enable()` の anon/authenticated EXECUTE を剥奪（migration 0011、リモート適用済み）→ 該当 WARN 解消を確認
- npm audit 実行: moderate 2件（next 同梱の postcss、GHSA-qx2v-qp2m-jg93）のみ。next 側の対応待ちのため記録のみ
- 仕様書 `docs/specs/11_security_hardening.md` を作成、CLAUDE.md の一覧に追記

## 決めたこと・理由

- セキュリティレビュー・改善はデプロイ後ではなく**デプロイ前に実施**する（公開後の修正は実データ・実ユーザーを抱えた状態になりリスクが大きいため）
- スコープはフル実施（コード修正 + セキュリティヘッダー + Supabase advisors / npm audit 点検）
- Cookie は改ざん可能なため、RLS 頼みにせずアプリ層でもメンバーシップを検証する（多層防御）
- CSP は Next.js のインラインスクリプトとの相性問題（nonce 対応が必要）で壊れやすいため今回は見送り

## 次にやること

- デプロイ（Vercel 想定）。デプロイ時に Supabase ダッシュボードで leaked password protection（HaveIBeenPwned 照合）を有効化する

## 未解決の課題

- CSP（Content-Security-Policy）の導入は未対応
- leaked password protection が無効のまま（ダッシュボード設定が必要、MCP からは変更不可）
- npm audit の moderate 2件（next 同梱 postcss）は next のアップデート待ち
