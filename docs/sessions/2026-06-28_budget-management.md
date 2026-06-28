# 2026-06-28 — 予算管理（予実）（spec 30）

## やったこと

- 機能仕様書 `docs/specs/30_budget_management.md` を作成、CLAUDE.md の spec 一覧を更新。
- マイグレーション `0019_budgets.sql`（budgets テーブル・`unique(household_id, category_id)`・RLS は `private.is_household_member`）を作成し Supabase（HouseholdAccount-tokyo）へ適用。型を再生成して `types/database.ts`・`types/index.ts`（`Budget`）に反映。
- 予実集計の純関数 `lib/budget.ts#buildBudgetRows` を TDD で実装（`lib/budget.test.ts` 9 ケース）。既存 `summarizeCategoryExpense` を流用。
- バリデーション `lib/validations/budget.ts`（金額は四則演算式対応）、Server Actions `app/(dashboard)/budgets/actions.ts`（`upsertBudget`/`deleteBudget`）を TDD で実装（`actions.test.ts` 6 ケース）。
- 専用ページ `app/(dashboard)/budgets/page.tsx` と進捗UI（`components/features/budgets/budget-progress-bar.tsx`・`budget-row-card.tsx`）を追加。合計予実カード＋カテゴリ別の設定/解除フォーム。
- ダッシュボード統合: `SummaryCards` に `budgetTotal`/`budgetSpent` を追加し消費バー直下に予算進捗バーを表示。`dashboard/page.tsx` で世帯全体の当期支出（予算設定済みカテゴリ分）を集計して受け渡し。
- ナビに「予算」を追加（`nav-items.ts`、モバイルタブは4件維持のため除外）。`nav-items.test.ts` を更新。
- 検証: typecheck・lint クリーン、単体 489 件 green、プロダクションビルド成功（`/budgets` ルート登録）。

## 決めたこと・理由

- 期間モデルは「毎月固定」。カテゴリごとに1つの予算額を設定し、毎期間（締め日基準）に同額を適用する。月別の個別予算は YAGNI で見送り。
- 予算対象は支出カテゴリ別のみ。合計予算はカテゴリ予算の自動合算として表示。
- 表示面は専用ページ `/budgets`（設定＋予実一覧）＋ ダッシュボードのサマリーに予算進捗バーを追加。
- 予算はグループ共有のため、ダッシュボードの予算進捗は scope（自分/全体）に関わらず**世帯全体の当期支出**と対比する。
- `budgets` テーブルは `created_by` スコープを持たず、categories と同様にメンバー全員が編集可（RLS は `private.is_household_member`）。

## 次にやること

- `npm run dev` での手動確認（要ログイン）と、余力があれば予算設定→予実表示の E2E 追加。
- PR 作成・レビュー → main へマージ。

## 未解決の課題

- カテゴリ削除時、予算は FK on delete cascade で連動削除される（履歴は残さない）。
- 予算の超過通知（バナー/プッシュ）は初版では行わず、ページ内の視覚表現のみ。
