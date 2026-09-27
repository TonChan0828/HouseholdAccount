# 2026-09-22 — E2E の PR 前倒しと共有環境の直列化

## 目的

- 共有 Supabase を使う E2E の同時実行による相互干渉を防ぐ。
- ブラウザ回帰を `main` へのマージ後ではなく PR 上で検出する。
- CI 失敗時の Playwright レポートと trace を回収できるようにする。

## 残存課題の比較

各項目を 1（小）〜5（大）で評価し、優先度は
`影響度 × 発生可能性 ÷ 修正コスト` とした。

| 課題 | 影響度 | 発生可能性 | 修正コスト | 優先度 | 判断 |
| --- | ---: | ---: | ---: | ---: | --- |
| 共有 Supabase を使う E2E の同時実行 | 5 | 5 | 1 | 25.0 | 今回対応 |
| E2E が PR では実行されず、回帰検出がマージ後 | 5 | 4 | 2 | 10.0 | 今回対応 |
| axe のログイン画面 color-contrast 検査が不安定 | 3 | 3 | 2 | 4.5 | 2026-09-27 対応。light/dark を明示して検査 |
| GitHub Actions を commit SHA で固定していない | 4 | 2 | 3 | 2.7 | 今後検討 |
| E2E ログ中の Base UI uncontrolled warning | 2 | 3 | 3 | 2.0 | 個別 UI 修正時に対応 |
| 仕様書に明記された将来機能（ソーシャルログイン等） | 3 | 2 | 5 | 1.2 | 製品判断が必要なため対象外 |

## 根拠

- `.github/workflows/e2e.yml` は `push: main` と手動実行だけで、PR を対象にしていなかった。
- E2E は固定の認証ユーザーと単一のリモート Supabase を共有する。
- 2026-09-22 の main E2E（run `35724111525`、11:54 UTC 開始）が動作中に、
  別ブランチの手動 E2E（run `35726508446`、12:19 UTC 開始）が重なり、双方が失敗した。
- `globalSetup` は接頭辞付きの一時グループを一括削除するため、並行実行時には
  別 run が使用中のデータも削除し得る。

## 変更

- E2E workflow を `pull_request` でも起動する。
- repository 全体で固定 concurrency group `e2e-shared-supabase` を使い、
  実行中 run をキャンセルせず後続 run を待機させる。
- fork PR は secrets を利用できないため E2E job を安全に skip する。
- 権限を `contents: read` に限定する。
- 失敗時に `playwright-report` と `test-results` を7日間 artifact として保存する。

## 対象外

- E2E の fixture を run ごとに完全分離すること。
- 専用 Supabase project の追加。
- GitHub の branch protection / required checks 設定変更。

## 検証結果

- workflow YAML parse: 成功
- `npm run lint`: 成功
- `npm run typecheck`: 成功
- `npm run test:coverage`: 116 files / 826 tests 成功、statement coverage 73.17%
- `npm run build`: 成功（Next.js 16.3.5、37 pages）
- local Supabase: 25 migrations の新規適用に成功
- `supabase test db`: 1 file / 30 tests 成功
- full E2E: 68 tests 成功（67 passed、ログイン画面の axe color-contrast 1件が retry で成功）

axe の retry は今回の workflow 変更に起因しない既存挙動であり、上の残存課題へ追加した。

## 2026-09-27 — テーマ別アクセシビリティ検査

- 公開画面のaxe検査で、ブラウザーの `prefers-color-scheme` を light / dark に明示する。
- ランディング・ログイン・デモダッシュボードを両テーマで検査し、CIホストのOS設定による差を避ける。
- `npm run test:a11y -- --repeat-each=2`: 12件成功。

PR 初回 E2E では `settlements.spec.ts` が3試行とも共通の60秒上限に達した。
保存した trace では、最後の「精算済みにする」click 開始時の残り時間が約0.22秒で、
画面と対象ボタンは正常に表示されていた。2ユーザーの認証・招待・収支登録・精算を
一つのシナリオで行うため、このテストだけ上限を120秒へ延長した。
