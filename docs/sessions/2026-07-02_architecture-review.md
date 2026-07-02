# 2026-07-02 — アーキテクチャレビュー

## やったこと

- コードベース全体（約16,000行）の構造・レイヤリング・重複を調査
  - 認証ガード定型文が約32箇所、メンバー名解決が6箇所、期間クエリが8箇所に重複
  - `ensureRecurringGenerated` が analytics/budgets/members で未呼び出し（月初の集計漏れ）を発見
- 仕様書 `docs/specs/35_architecture_refactor.md` を作成し、4段階で TDD 実装
  1. `refactor`: `requireDashboardContext()` を lib/household.ts に追加し21ファイルの定型ガードを集約（-359/+163行）
  2. `refactor`: `lib/queries/members.ts#getHouseholdMemberNames` で表示名フォールバックを単一実装点に集約
  3. `refactor`: `lib/queries/transactions.ts#fetchTransactionsInRange` で期間クエリ6ページ分を集約（calendar のみ `order: "asc"`）
  4. `fix`: analytics/budgets/members に定期収支の閲覧時生成を追加（Server Component を関数として呼ぶページ単体テストで検証）
- 各段階で typecheck / lint / unit 全通過 + E2E 53件（--workers=1）全通過を確認してからコミット
- `docs/user-stories.md` に #35 を追記（期跨ぎ検証をユニットで代替する根拠を明記）

## 決めたこと・理由

- 置換除外: `settings/*`（グループ不要）、`app/households`（未所属でも開ける）、`export/route.ts`（401/403 を返す Route Handler・CSV は null フォールバックが仕様）
- `fetchTransactionsInRange` の select はカラム最大集合に統一し、呼び出し側が必要分だけ使う（クエリ増加より保守性優先）
- 段階4のテストは Server Component を async 関数として直接呼び出す方式を採用（レンダリング不要で生成呼び出しを検証できる）

## 次にやること

- （バックログ）メンバー間精算、検索・絞り込み強化

## 未解決の課題

- `types/database.ts`（536行・手書き）を `supabase gen types typescript` 生成に切り替えるか別途検討
- E2E `household.spec.ts:188` が全体実行時に1回フレーク（単体・再実行では通過）。再発するようならセレクタ/待機を見直す
