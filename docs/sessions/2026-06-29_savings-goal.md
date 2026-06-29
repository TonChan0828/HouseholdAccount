# 2026-06-29 — 貯金目標機能

## やったこと

- 仕様書 `docs/specs/32_savings_goal.md` を作成、CLAUDE.md の spec 一覧に追記（予定）。
- **Task 1**: `supabase/migrations/` に `savings_goals` テーブルを追加。
  - カラム: id, household_id(UNIQUE), name, target_amount, start_date, target_date(nullable), created_by, created_at。
  - RLS: `household_members` に所属する世帯のみ SELECT/INSERT/UPDATE/DELETE 可能。
- **Task 2**: `lib/savings-goal.ts` に純関数 `buildSavingsProgress` を実装（Vitest で TDD）。
  - 入力: 目標情報 + 開始日以降の収支サマリー。
  - 出力: `SavingsProgress`（saved / remaining / pct / reached / pace）。
  - pace: 期日がある場合のみ計算（monthsLeft / requiredPerMonth / overdue）。
- **Task 3**: 目標額フォームに四則演算入力（`evaluateAmount`）を追加。
  - 既存の `lib/expression.ts` の `evaluateAmount` を再利用。
- **Task 4**: Server Actions `upsertSavingsGoal` / `deleteSavingsGoal` を実装。
  - `app/(dashboard)/dashboard/savings-goal-actions.ts`。
  - upsert: household_id + name + target_amount + start_date + target_date を受け取り、`savings_goals` へ UPSERT（ON CONFLICT household_id）。
  - delete: 当該グループの目標を削除。
  - 戻り値型: `SavingsGoalActionState = { ok: true } | { error: string } | undefined`。
- **Task 5**: `components/features/dashboard/savings-goal-card.tsx` を実装（Client Component）。
  - 表示: 進捗バー・パーセント・paceNote（残り・ペース・達成・期日超過）。
  - 設定ダイアログ: `GoalForm`（useActionState + upsertSavingsGoal）。
  - Vitest で 4 テストケース（未設定・進捗表示・達成・期日ペース）。
- **Task 6**: `app/(dashboard)/dashboard/page.tsx` に貯金目標データを接続。
  - `savings_goals` と開始日以降の収支サマリーを `Promise.all` で並行取得。
  - `buildSavingsProgress` でクライアントに渡す `SavingsProgress` を計算。
  - `SavingsGoalCard` をダッシュボード（server component）に埋め込み。
- **Task 7**: 解除ボタン・ヘルプ・セッションログ（本セッション）。
  - `savings-goal-card.tsx` の `GoalForm` に `hasGoal: boolean` を追加。
  - 目標設定済みのときのみ `<DialogFooter>` 内に「目標を解除」フォームを表示。
  - `deleteSavingsGoal` を再インポート。
  - `components/features/help/help-content.ts` のダッシュボード直後に「貯金目標」セクションを追加。

## 決めたこと・理由

- **グループに1件**: `savings_goals.household_id` に UNIQUE 制約。シンプルな仕様で RLS も整合しやすい。
- **進捗 = 開始日以降の収支差額**: 実際の支出・収入に基づく自然な貯蓄額計算。手動の入金管理は不要。
- **期日は任意**: 期日なしでも残額のみ表示。期日ありでペース計算を加算。
- **ダッシュボードのみ表示**: 専用ページは作らず、ダッシュボードカードで完結（仕様スコープ）。
- **Dialog に base-ui を使用しない**: 既存 shadcn/ui の Dialog コンポーネントを流用し、コンポーネント差異を回避。
- **Server Action の型**: `SavingsGoalActionState = { ok: true } | { error: string } | undefined`。`useActionState` の初期値を `undefined` にし `"ok" in state` で成功判定。

## 未解決の課題

- 開始日より前のデータが後から追加された場合のリアルタイム更新（ページリロードが必要）
- 目標額の式入力のプレビューは収支フォームと同パターンにすると UX が統一されるが、今回はスコープ外
