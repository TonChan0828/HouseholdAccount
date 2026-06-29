# 2026-06-29 — 分析画面のルールベース家計アドバイス

## やったこと

- 仕様書 `docs/specs/31_analytics_advice.md` を作成、CLAUDE.md の spec 一覧に追記。
- TDD で `lib/advice.test.ts`（16ケース）→ `lib/advice.ts#buildAdvice` を実装。
  - ルール: 赤字 / 貯蓄率低下・良好・改善 / 予算カテゴリ超過(最大2)・全体超過・予算内 /
    カテゴリ集中度 / 前期比増減・3期連続増加 / データ不足。severity 優先ソート・最大5件。
- 表示用 `components/features/charts/advice-section.tsx`（Server Component、severity 別配色）。
- `app/(dashboard)/analytics/page.tsx` で budgets/categories を追加取得（Promise.all）し、
  `buildAdvice` を呼んで KPIリボン直下に「家計アドバイス」セクションを描画。
- 検証: `npm run test:run`（505 passed）/ `typecheck` / `lint` / `build` すべて green。
- フィードバック対応: 「家賃など固定費がトップなのは当然」→ 集中度ルールを改修。
  定期支出（recurring・active・expense）に紐づくカテゴリを固定費とみなし母数から除外。
  さらに変動費カテゴリが1つだけなら自明な100%集中になるため抑制（MIN_VARIABLE_CATS=2）。
  文言を「固定費を除く支出の X% が…」に変更。テスト2件追加（計18）。
- フィードバック対応: 変化ベース検知ルール⑤を追加。`lib/analytics.ts#summarizeCategoryTrend`
  でカテゴリ別の期別支出を集計し、当期が直近平均より大きく増えた（×1.4超・増加額¥5000以上）
  カテゴリだけを warn で指摘（増加額降順・最大2件）。家賃など一定の固定費は発火しない。
  spec・page を更新。`npm run test:run`（514 passed）/ typecheck / lint / build すべて green。

## 決めたこと・理由

- 分析画面に「ルールベースのアドバイス」セクションを追加する方針を決定。
  - 対象ルール: 予算超過の検知 / 支出トレンド / カテゴリ集中度 / 貯蓄率・収支バランス
  - 表示場所: `/analytics` の上部（KPIリボン直下）に新セクション
  - トーン: 警告＋改善提案＋称賛のバランス（severity で色分け）
- 既存パターン（純関数 + Vitest → Server Component で表示）に沿わせる。
  集計済みデータ（trend / categories / budget）を再利用し、`lib/advice.ts#buildAdvice` で評価する。

## 次にやること

- 仕様書 `docs/specs/31_analytics_advice.md` を作成
- TDD で `lib/advice.test.ts` → `lib/advice.ts`
- `components/features/charts/advice-section.tsx`
- `app/(dashboard)/analytics/page.tsx` へ接続

## 未解決の課題

- 月末着地予測（当期進行中のプロレーション）は今回スコープ外
