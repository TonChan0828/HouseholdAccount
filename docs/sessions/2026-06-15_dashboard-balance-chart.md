# 2026-06-15 — ダッシュボードに当期収支の棒グラフを追加

## やったこと

- 仕様書 `docs/specs/03_dashboard.md` に「当期収支グラフ」を追記（概要・レイアウト・表示内容・データモデル・コンポーネント・テスト・未解決課題）
- データ整形の純関数 `lib/analytics.ts#buildBalanceBars(income, expense)` を TDD で追加（収入→支出の順で `{ label, amount, key }` を2本返す）
  - `lib/analytics.test.ts` にユニットテスト追加（順序・ラベル・key・金額、0円時も2本）
- 棒グラフコンポーネント `components/features/charts/balance-bar-chart.tsx` を新設（`"use client"`）
  - props `{ income, expense }` を受け取り `buildBalanceBars` で整形、Recharts `BarChart` + `Cell` で収入=緑 `--income` / 支出=赤 `--expense` に色分け
  - 既存 `trend-bar-chart.tsx` のスタイル（円表記 `compact` / `yen`、`h-56 w-full`、ResponsiveContainer）を踏襲
- `app/(dashboard)/dashboard/page.tsx` の `SummaryCards` 直後に Card でラップして配置。既存の scope 適用済み `income`/`expense` をそのまま渡す
- 最終検証: `npm run test:run`（177件）/ `npm run typecheck` / `npm run lint` / `npm run test:e2e dashboard.spec.ts`（3件）すべて PASS

## 決めたこと・理由

- 期間は「当期のみ・収入/支出の2本」（ユーザー確認）。複数期の推移は分析(05)の既存 `TrendBarChart` の領域なので新規コンポーネントを分けた
- 新規クエリは作らず、サマリーカード用に算出済みの scope 適用済み `income`/`expense` を共有 → メンバーフィルター（全体/自分）に自動連動・データ取得の重複なし
- jsdom で ResponsiveContainer の描画検証は不安定なため、テスト対象はデータ整形の純関数 `buildBalanceBars` に寄せた（既存 `analytics.ts` のテスト方針と整合）

## 備考

- E2E実行時に Recharts の `width(-1)/height(-1)` 警告がログに出るが、初期レイアウト時の一過性メッセージで既存の analytics チャートでも出ており回帰ではない。テストは PASS
