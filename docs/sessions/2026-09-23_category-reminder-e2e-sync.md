# 2026-09-23 — カテゴリ通知 E2E の Server Action 同期

## 目的

- 月区切り更新の Server Action 完了前に別画面へ遷移する E2E の競合を解消する。
- `main` E2E が全 retry で失敗する状態を、実際の更新完了を同期点にして安定化する。

## 残存課題の再採点

各項目を 1（小）〜5（大）で評価し、優先度は
`影響度 × 発生可能性 ÷ 修正コスト` とした。

| 課題 | 影響度 | 発生可能性 | 修正コスト | 優先度 | 判断 |
| --- | ---: | ---: | ---: | ---: | --- |
| カテゴリ通知 E2E が Server Action 完了前に遷移 | 5 | 4 | 1 | 20.0 | 今回対応 |
| GitHub Actions の Node.js 20 action 世代に非推奨警告 | 4 | 5 | 2 | 10.0 | 次点 |
| GitHub Actions を commit SHA で固定していない | 4 | 2 | 3 | 2.7 | 今後検討 |
| E2E ログ中の Base UI uncontrolled warning | 2 | 3 | 3 | 2.0 | 個別 UI 修正時に対応 |
| 仕様書に明記された将来機能 | 3 | 2 | 5 | 1.2 | 製品判断が必要なため対象外 |

PR #78 の共有環境直列化と PR #79 の axe 安定化はマージ済みのため候補から除外した。

## 根拠と原因

- `main` E2E run `35803729811` はカテゴリ通知シナリオが初回と retry 2回の全てで失敗した。
- 保存後のダッシュボードは全試行で既定の `2026/09/01〜2026/09/30` と
  `残り7日` を表示しており、テストが設定した月区切りは反映されていなかった。
- Playwright の `click()` は、画面遷移を伴わない Next.js Server Action の POST 完了を
  同期点にしない。直後の `page.goto("/dashboard")` が低速なリモート更新を中断し得る。
- 変更前は保存ボタンの click 後に、更新完了を示すレスポンスや UI を確認していなかった。

## 変更

- 保存前に `/households` への POST response 待機を登録する。
- 保存ボタンを押した後、response の成功ステータスと本文ストリーム完了を確認してから
  ダッシュボードへ遷移する。ヘッダー到着だけでは Next.js の RSC response を
  後続 navigation が中断するため、`response.finished()` まで待つ。
- 固定 sleep や timeout 延長ではなく、実際の Server Action 完了を同期点にする。

## 検証結果

- 対象 E2E 3回反復: 3/3 passed、Server Action の中断ログなし
  （認証 setup を含めると 4/4 passed）
- `npm run lint`: 成功
- `npm run typecheck`: 成功
- `npm run test:coverage`: 117 files / 833 tests 成功、statement coverage 73.58%
- `npm run build`: 成功（Next.js 16.3.5、37 pages）

DBスキーマ・アプリ実装・依存関係には変更がないため、ローカル DB 検証は対象外とした。
全 E2E は PR の直列化済み workflow で確認する。
