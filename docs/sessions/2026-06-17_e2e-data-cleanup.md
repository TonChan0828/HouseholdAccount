# 2026-06-17 — E2Eテストデータの開始時クリーンアップ

## やったこと

- 仕様書 `docs/specs/18_e2e_data_lifecycle.md` を作成（接頭辞分離方式・開始時クリーンアップ）
- TDD で `e2e/constants.ts` に `ephemeralName()` / `isEphemeralName()` と接頭辞 `__e2e_tmp_` を追加（`e2e/constants.test.ts`、安全性テスト含め5件パス）
- `e2e/global-setup.ts` を追加。実行開始時に service-role で接頭辞付きグループのみ削除（CASCADE で収支・カテゴリ・メンバーも連鎖削除）
- 既存スペック16箇所のグループ名を `ephemeralName()` に置換、未使用化した `stamp` を除去
- `playwright.config.ts` に `globalSetup` 追加＋`.test.ts` を Playwright から除外。`vitest.config.ts` は `e2e/**/*.spec.ts`・`*.setup.ts` のみ除外し `e2e/*.test.ts` を拾うよう調整
- `.env.example` に `SUPABASE_SERVICE_ROLE_KEY` を記載
- 欠落していた seed フィクスチャ（2人グループ `E2Eダッシュボード-1781044939636`）を DB に復元
- `feature/e2e-data-cleanup` ブランチに docs / test の2コミットを作成

## 決めたこと・理由

- **「終了後」ではなく「開始時」クリーンアップ**: afterEach/afterAll は例外でスキップされゴミが残るため。開始時なら前回が落ちても必ず回収でき、失敗時の残骸調査もしやすい
- **接頭辞分離方式**: seed フィクスチャと同じ命名規則（`E2Eダッシュボード-<数字>`）のため、パターン一致削除では誤削除の危険。専用接頭辞で名前空間を分離し事故を防ぐ
- **LIKE を使わず JS フィルタ**: 接頭辞の `_` が SQL LIKE のワイルドカードになり誤マッチするため、全取得後に `isEphemeralName` で厳密判定
- **キー未設定時は明示エラーで停止**: クリーンアップを黙ってスキップして蓄積問題を再発させないため

## 次にやること

- `feature/e2e-data-cleanup` の push / PR 作成（未実施）
- CI シークレットに `SUPABASE_SERVICE_ROLE_KEY` を設定（CI で globalSetup を動かす場合）

## 未解決の課題

- seed フィクスチャが「いつ・何で」消えたか未調査（今回は復元のみ）。再発するなら原因（過去の脱退/委譲/退会テスト等）の特定が必要
- seed データを再現可能にするため、フィクスチャ投入スクリプト or マイグレーションの整備を検討
