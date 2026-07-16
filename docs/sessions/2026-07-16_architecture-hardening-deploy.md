# 2026-07-16 — アーキテクチャ強化のデプロイ

## 目的

- spec 39 の実装を Supabase / Vercel / GitHub へ安全に反映する。

## 開始時確認

- ローカル migration は `0001`〜`0023`、リモート履歴はタイムスタンプ形式で一致していない。
- `.env.local` は Supabase URL / service-role key 設定済み。
- Vercel project は `household-account` にリンク済み。
- `CRON_SECRET` / `NEXT_PUBLIC_APP_URL` はローカル未設定。

## 実施結果

- リモートDBの事前検査で不正データ・家計簿をまたぐカテゴリ参照が0件であることを確認した。
- migration履歴形式がローカルと異なるため `db push` は使わず、`0023_architecture_hardening.sql` をリンク済みDBへ直接適用した。
- 適用後に以下を確認した。
  - `generate_all_due_recurring(date)` が存在する。
  - `service_role` のみ実行でき、`authenticated` は実行できない。
  - 収支の家計簿スコープ付きカテゴリ外部キーと、退会時の定期項目停止トリガーが存在する。
- Vercel Production に `SUPABASE_SERVICE_ROLE_KEY` / `CRON_SECRET` / `NEXT_PUBLIC_APP_URL` を設定し、Preview に `NEXT_PUBLIC_APP_URL` を設定した。
- GitHub Actions に E2E 用の Supabase シークレット3項目を設定した。
- リモート移行後の全E2Eを再実行した。フルスイート後半でグループ作成の遷移が既定5秒を超えたため、対象待機を15秒へ限定して安定化した。
- 最終結果: E2E 58件すべて成功（`--workers=1`）。
- 実装コミット `5219bb9` を `main` へpushし、Vercel Production が Ready になったことを確認した。
- 初回GitHub E2Eで、Node.js 20にはSupabase Realtimeが必要とするネイティブWebSocketがないことを検出した。CI/E2EをNode.js 22へ統一し、DatabaseワークフローをSupabase変更の`main` pushでも実行するよう修正した。
- Node.js 22でのGitHub E2Eでは、低速なrunner上で2件が既定30秒を超過した。CI時のみテスト上限60秒・expect上限15秒へ調整し、失敗した2 specをCI条件で再実行して4件すべて成功した。
