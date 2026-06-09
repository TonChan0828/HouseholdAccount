# 2026-06-09 — ダッシュボード（03_dashboard）

## やったこと

- ダッシュボードの設計をブレインストーミングで確定
- PR #2（develop→main）を作成し、squash 分岐由来のコンフリクトを `git merge -s ours origin/main` で解消（mergeable: clean）
- 仕様書 03_dashboard.md を作成

## 決めたこと・理由

- ダッシュボードはアクティブ household の**当期間**（`period_start_day` を流用、`lib/period.ts`）の読み取りサマリー
- **期間ナビは置かず「今の期間」固定**（詳細・期間移動は /transactions に委譲し、ダッシュボードは一目で把握する画面に保つ）
- 表示は **収入計 / 支出計 / 収支差 のカード** ＋ **最近の取引（当期間の最新5件）**
- **「全体/自分」トグル**（`?scope=all|mine`、既定 all）。メール表示不要で今すぐ作れる。個人名別フィルタはメンバー機能（07）で対応
- /transactions の既存コードは変更しない（DRY のための無関係改修を避ける）

## 実装（2026-06-10）

- TDD で `SummaryCards`（収入/支出/収支差）と `ScopeToggle`（全体/自分・現在値強調）を実装（Component テスト 5 件）
- `app/(dashboard)/page.tsx` を当期間固定のサマリー＋最近の取引（最新5件）＋scopeトグルで実装。`?scope=mine` で `created_by = auth.uid()` に絞る
- `/transactions` の既存コードは変更せず、表示はダッシュボード側で再実装（DRY のための無関係改修を回避）
- E2E `e2e/dashboard.spec.ts` を追加し明示実行（収支追加→サマリー反映→全体/自分トグル遷移）。サマリー金額の重複ヒット回避に `data-testid="summary-cards"` を付与
- 検証: Unit 51 件 / typecheck / lint / E2E すべて green

## 次にやること

- コミット（feat: ダッシュボード / test / docs）と develop への取り込み

## 未解決の課題

- 個人名別フィルタ（メンバー機能 07 で auth.users 連携後）
- カテゴリ別内訳のミニ表示は分析（05）の領域。ダッシュボードには含めない
