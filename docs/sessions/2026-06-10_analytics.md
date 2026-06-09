# 2026-06-10 — 月次分析（05_analytics）

## やったこと

- ダッシュボード（03）を TDD 実装・E2E 検証してコミット（feat/test/docs の3コミット）
- 月次分析（05）をブレインストーミングで設計確定 → 仕様書 `docs/specs/05_analytics.md` を作成
- 月次分析を TDD 実装:
  - `lib/analytics.ts` — `summarizeTrend` / `summarizeCategoryExpense`（純関数、ユニット6件）
  - `components/features/charts/trend-bar-chart.tsx`（収入/支出の棒グラフ）
  - `components/features/charts/category-pie-chart.tsx`（カテゴリ別円グラフ＋凡例、空データでプレースホルダ、Component2件）
  - `app/(dashboard)/analytics/page.tsx` — 6期取得→集計→チャート、`MonthNav` 再利用・`?ref=` 期間ナビ
  - ダッシュボードに「分析」導線を追加
- E2E `e2e/analytics.spec.ts` を明示実行（収支追加→分析反映→期間ナビ）

## 決めたこと・理由

- 分析は **グラフ2種に集中**（月別推移＋当期カテゴリ別支出）。メンバー別切り替えは機能07（auth.users 連携）後に先送り
- 推移は **収入/支出の棒グラフ × 直近6期**、内訳は **当期の支出をカテゴリ別円グラフ**
- 期間ナビは **あり**（`?ref=`、`shiftPeriod` 流用、transactions と同じ作法）
- **集計は DB ではなく `lib/analytics.ts` の純関数**で行い TDD（チャート描画自体は検証せず、集計とプレースホルダ表示を検証）
- 方式A: 6期分を1クエリで取得しJS集計（YAGNI、RPC/group by は導入しない）

## 検証

- Unit/Component 59 件 / typecheck / lint すべて green
- E2E 全9件 green（分析2件含む）
- 補足: Recharts の ResponsiveContainer がナビ遷移時に一時的に width/height(-1) の警告を出すが、描画・テストには影響なし

## 次にやること

- カテゴリ管理（04）、メンバー別アクティビティ（07）など残機能

## 未解決の課題

- メンバー別切り替え（機能07 で auth.users 連携後）
- 収入のカテゴリ別内訳トグル（当面は支出のみ）
- 推移グラフの期数の可変化（当面は6期固定）
