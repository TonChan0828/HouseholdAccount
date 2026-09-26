# 2026-09-26 — 年間分析（分析画面に年間ビューを追加）

## やったこと

- 仕様書 `docs/specs/42_yearly_analytics.md` を作成（CLAUDE.md 一覧・05 の未解決課題・user-stories を更新）
- `lib/period.ts` に `getYearRanges` / `yearFromParam` を追加（TDD）
- `lib/yearly-analytics.ts`（`summarizeYear` / `countElapsed` / `compareCategoryYoY`）を新規作成（TDD）
- `lib/advice.ts` に年間アドバイス `buildYearlyAdvice` を追加（TDD・境界値テスト含む）
- UI: `AnalyticsViewTabs`（月次/年間）、`YoyComparison`（前年同期比）、`app/(dashboard)/analytics/yearly-view.tsx`、`CategoryBreakdown` に `emptyMessage` を追加
- ヘルプの分析セクションに年間ビュー・前年比較の説明を追記
- E2E `e2e/analytics-yearly.spec.ts` を追加。Unit 832件・E2E 64件（`--workers=1`）全通過

## 決めたこと・理由

- 年の定義は「暦年（締め日考慮）」: Y年 = 開始月が Y年1月〜12月の12期（既存 getPeriodRange の規約に合わせる）
- 配置は /analytics 内の「月次 / 年間」タブ切替（?view=year&year=YYYY）。ナビ項目は増やさない
- 内容: 月別推移（12期）＋年間KPI / カテゴリ別年間支出 / 前年比較 / 年間アドバイス
- 年の途中は「前年同期」（当年の経過期数ぶんの前年）と比較する。前年まるごとだと進行中の年が常に「減少」に見えるため
- 年間ビューは前年1期目〜当年末の24期ぶんを1回の範囲クエリで取得し、JS で振り分ける

## 次にやること

- コミット（docs: 仕様書 → feat: 年間分析 → test: E2E → docs: セッションログ）

## 未解決の課題

- デモモードの年間分析・メンバー別の年間分析・年間予実・年度（4月始まり等）
- ヘルプの分析セクションに未実装の「メンバー別の切り替え」の記述が残っている（既存の不整合）
- ローカルのポート 3000（PlanDiff）/3100（/private/tmp の古い dev サーバー・応答なし）が塞がっており、E2E は `E2E_PORT=3217` で実行した
