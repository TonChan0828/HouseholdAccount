# 2026-10-07 — マイグレーション適用漏れのCI検知

## やったこと

- 収支登録後に「データを読み込めませんでした」になる障害を調査した。原因は本番DBにマイグレーション 0032（RPC `transaction_daily_summary`）が未適用だったこと（PGRST202）
- ユーザーが `supabase db push --linked` で 0032 を適用した。RPC が存在すること（anon で 42501）と、収支系 E2E 6件の通過を確認した
- 再発防止として `scripts/check-migration-drift.mjs`（ユニットテスト付き）と `.github/workflows/migration-drift.yml` を追加した
- 仕様書 39 に「マイグレーション適用漏れの検知」の節を追加し、CLAUDE.md の DB 規約に運用を追記した

## 決めたこと・理由

- 検知は PR・main push・毎日定期の3つで行う。PR 時点で止めれば、適用漏れのコードが本番にデプロイされる前に気づける
- 認証は `SUPABASE_ACCESS_TOKEN` だけを使う。CLI がログインロールを自動作成するので DB パスワードは不要（CI と同じ手順で確認済み）
- `migration list` は `--output-format json` が効かないので表を解析する。1行も読めない場合は失敗にして、見逃しを防ぐ
- 本番にしかないマイグレーション（ダッシュボードから直接適用したものなど）もずれとして検知する

## 次にやること

- GitHub Secrets に `SUPABASE_ACCESS_TOKEN` を登録する
- 必要に応じて Migration Drift を main のブランチ保護の必須チェックにする

## 未解決の課題

- 適用は手動のまま。自動適用（main マージ時の `db push`）にするかは、後方互換でないマイグレーションの扱いを含めて別途検討する
