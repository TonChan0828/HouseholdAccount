# 2026-09-23 — アクセシビリティ検査のアニメーション待機

## 目的

- 公開画面の axe 検査が `fade-in` の途中を測定して不安定になる問題を解消する。
- 再試行で偶然成功する状態をやめ、最終描画状態の WCAG コントラストを検査する。

## 残存課題の再採点

各項目を 1（小）〜5（大）で評価し、優先度は
`影響度 × 発生可能性 ÷ 修正コスト` とした。

| 課題 | 影響度 | 発生可能性 | 修正コスト | 優先度 | 判断 |
| --- | ---: | ---: | ---: | ---: | --- |
| axe が初期アニメーション中の色を測定して不安定 | 4 | 5 | 1 | 20.0 | 今回対応 |
| GitHub Actions の Node.js 20 action 世代に非推奨警告 | 4 | 4 | 2 | 8.0 | 次点 |
| GitHub Actions を commit SHA で固定していない | 4 | 2 | 3 | 2.7 | 今後検討 |
| E2E ログ中の Base UI uncontrolled warning | 2 | 3 | 3 | 2.0 | 個別 UI 修正時に対応 |
| 仕様書に明記された将来機能 | 3 | 2 | 5 | 1.2 | 製品判断が必要なため対象外 |

PR #78 で共有 Supabase の E2E 競合と PR 前検証は解消済みのため、候補から除外した。

## 原因

- 認証レイアウトなどは Tailwind の `animate-in` / `fade-in` を 700ms 適用する。
- 既存テストは `main` が visible になった直後に axe を実行していた。
- 30回（3画面 × 10反復）の再現実行では 7 failed / 12 flaky / 11 passed となった。
- 失敗時の axe 出力では同じ要素の色とコントラスト比が試行ごとに変化していた。
  たとえばログイン説明文は 3.28、再試行では 4.25 と測定されており、
  最終色ではなくフェード中の合成色を評価していた。

## 変更

- `main` 配下の Web Animations API が返す初期アニメーションの `finished` を待ってから
  axe を実行する。
- 固定時間の sleep は使わず、実際のアニメーション完了を同期点にする。

## 検証結果

- 修正前 `test:a11y -- --repeat-each=10`: 30件中 7 failed / 12 flaky / 11 passed
- 修正後 `test:a11y -- --repeat-each=10`: 30/30 passed、retry 0
- 通常の `npm run test:a11y`: 3/3 passed
- `npm run lint`: 成功
- `npm run typecheck`: 成功
- `npm run test:coverage`: 117 files / 833 tests 成功、statement coverage 73.58%
- `npm run build`: 成功（Next.js 16.3.5、37 pages）

DB・アプリの実装・依存関係には変更がないため、ローカル DB 検証は対象外とした。
全 E2E は PR の直列化済み workflow で確認する。
