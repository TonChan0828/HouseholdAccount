# 予算管理（予実） 仕様書

## 概要

支出カテゴリごとに毎月の予算額を設定し、当期（締め日 `period_start_day` 基準の会計期間）の実績支出と対比して進捗・超過を可視化する機能。専用ページ `/budgets` で予算の設定と予実一覧を行い、ダッシュボードのサマリーにも予算合計の進捗バーを追加する。共有家計簿の「使いすぎを防ぐ」体験を強化する。

## 対象ユーザー・前提条件

- ログイン済みかつ家計簿グループ（household）を選択済みのユーザー。
- 未ログインは `/login`、グループ未選択は `/households` へリダイレクト（他ダッシュボードページと同じ）。
- 予算はグループ単位で共有され、メンバー全員が設定・編集できる。

## 機能要件

- 期間モデルは**毎月固定**。1カテゴリにつき予算は1つで、毎期間に同額を適用する。
- 予算対象は**支出カテゴリ別のみ**（`type in ('expense','both')`）。合計予算はカテゴリ予算の自動合算。
- 実績は当期（`getPeriodRange` による締め日基準期間）のカテゴリ別支出合計。
- 予算未設定のカテゴリは進捗対象外（合計予算にも含めない）。

## 画面・UI

### `/budgets` ページ

- `PageHeader`（eyebrow="管理" / title="予算"）。
- 月ナビ（`MonthNav`）: 当期ラベルと前期/次期ボタン。実績は期間で変化、予算は固定。
- 合計予実カード: 当期の合計支出 / 合計予算、全体進捗バー、超過時の警告表示。
- カテゴリ別予実リスト: 各支出カテゴリ行に `CategoryBadge` ＋ 進捗バー ＋ 「実績 / 予算」「N%」「残りM円」または「超過 +M円」。
- 予算設定 UI: 各カテゴリ行に予算額の入力欄＋保存。設定済みは解除（未設定に戻す）可。

### ダッシュボード統合

- `SummaryCards` に予算合計の進捗バーを追加（`budgetTotal` が指定され >0 のとき）。
- 実績は**世帯全体の当期支出**を用いる（scope=mine でも全体実績と対比）。

### インタラクション・バリデーション

- 予算額は1円以上の整数。金額欄は四則演算式入力に対応（`evaluateAmount`、spec 25 と同様）。
- 月ナビは `?ref=YYYY-MM-DD` の URL リンクで遷移（サーバー再描画）。

## データモデル

### budgets テーブル

```sql
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  amount integer not null check (amount >= 1),
  created_at timestamptz not null default now(),
  unique (household_id, category_id)
);
create index budgets_household_idx on public.budgets (household_id);
```

### 集計（lib/budget.ts）

```typescript
type BudgetRow = {
  categoryId: string;
  name: string;
  color: string;
  budget: number;   // 未設定は 0
  spent: number;    // 当期実績
  pct: number;      // budget>0 のとき round(spent/budget*100)、それ以外 0
  over: boolean;    // spent > budget（budget>0 のとき）
};
type BudgetSummary = {
  rows: BudgetRow[];
  totalBudget: number;
  totalSpent: number;  // 予算設定済みカテゴリの実績合計
  totalPct: number;
  over: boolean;
};
function buildBudgetRows(
  budgets: { category_id: string; amount: number }[],
  expenseSlices: { categoryId: string | null; name: string; color: string; amount: number }[],
  categories: { id: string; name: string; color: string | null }[],
): BudgetSummary;
```

既存 `lib/analytics.ts#summarizeCategoryExpense` を流用して当期のカテゴリ別実績 `expenseSlices` を得る。

## Supabase

### RLS ポリシー

- `budgets` の全操作（select / insert / update / delete）を `private.is_household_member(household_id)` で当該グループのメンバーに許可（categories と同方針。`created_by` 制約は無し）。

### Server Action（app/(dashboard)/budgets/actions.ts）

- `upsertBudget(prevState, formData)`: `(household_id, category_id)` を競合キーに upsert（`onConflict: "household_id,category_id"`）。amount を zod でバリデーション。
- `deleteBudget(formData)`: `category_id` ＋ `household_id` でスコープして削除（予算解除）。
- どちらも `getActiveHouseholdId()` でスコープ、`revalidatePath("/budgets")`・`revalidatePath("/dashboard")`。

## ナビゲーション

- 主要ナビ（デスクトップ）に「予算」を追加（分析の近く）。モバイル下部タブの構成は維持し、必要なら「その他」系から到達可能にする（実装時にナビ構成を確認）。

## 未解決の課題

- カテゴリ削除時、予算は FK `on delete cascade` で連動削除される（履歴は残さない）。
- 予算の超過通知（バナー/プッシュ）は初版では行わず、ページ内の視覚表現のみ。
- 月別の個別予算設定は将来拡張（初版は毎月固定）。
