# 2026-07-10 — カテゴリ別登録漏れリマインダーの視認性改善（カード強調 + 設定説明）

## やったこと

- `docs/specs/38_category_reminder.md` を更新（カードの amber 強調・「残りn日」バッジ・`/categories` の説明ノートを追記）
- `UnrecordedCategoriesReminderCard` を警告らしい見た目に変更（TDD）
  - amber の枠線 + 薄い amber 背景（ライト/ダーク両対応）で他カードと差別化
  - ヘッダー行に「残りn日」バッジを追加（`daysRemaining` prop を新設、`forecast.daysRemaining` を渡す）
  - タイトル文字色も amber 系に変更
- `/categories` のページヘッダー直下に説明ノートを追加（`data-testid="category-reminder-note"`）
  - Bell アイコン + 「通知ONにすると、締め日の3日前までにそのカテゴリの登録が無い場合、ダッシュボードでお知らせします」
- テスト
  - `unrecorded-categories-reminder-card.test.tsx` に「残り日数バッジ」「amber 強調スタイル」のテストを追加（Red→Green を確認）
  - `e2e/categories.spec.ts` に説明ノートの表示・リマインダーカードの「残りn日」表示の検証を追加（Red→Green を確認）
- `docs/user-stories.md` の 38 を更新
- 検証: Vitest 653件 / typecheck / lint / E2E 58件（`--workers=1`）すべて通過

## 決めたこと・理由

- 強調方法はユーザーと相談し「カード強調 + 設定説明」を採用（フルワイドバナー案・カード強調のみ案は不採用）
  - ダッシュボードのリマインダーカードを amber の枠線 + 薄い amber 背景で警告らしく強調し、「残りn日」を表示する
  - `/categories` にトグルの意味の説明文を追加し、機能自体の発見性を上げる
- 「残りn日」の表記は既存の `ForecastCard` と揃えた
- Card ベースの `ring-1 ring-foreground/10` は `ring-0` で打ち消し、`border border-amber-300` に置き換え（tailwind-merge で後勝ち）
- 仕様書は新番号を振らず 38 を更新（既存機能の UI 改善のため）

## 次にやること

- コミット（`feat: カテゴリ別登録漏れリマインダーの視認性を改善`）

## 未解決の課題

- 通知対象カテゴリ数が多い場合の表示上限は引き続き未定義（38 の既存課題）
- デモモードのダッシュボードにはリマインダーカード自体が無い（機能パリティは対象外のまま）
