# 25. 定期収支（Recurring Transactions）

## 機能概要・目的

家賃・サブスクなどの固定費や給与などの固定収入を「定期項目」として登録しておくと、
各期間の開始日（household の `period_start_day`）の日付で収支を自動生成する機能。
毎期の手入力と登録漏れをなくすことが目的。

- **トリガー**: メンバーがアプリ（ダッシュボード／収支一覧）を開いたタイミングでサーバー側が
  冪等に生成する（Vercel Cron 等の外部スケジューラ・サービスロールキー・秘密鍵は不要）。
- **登録日**: household の `period_start_day`（1〜28）のみ。項目ごとの日付指定はしない。
- **管理**: 専用ページ `/transactions/recurring`。メンバー全員が自分の定期項目を作成・編集・削除できる。

## データモデル

### `recurring_transactions`（新規テーブル）

| 列 | 型 | 備考 |
| --- | --- | --- |
| id | uuid pk | |
| household_id | uuid not null → households(id) on delete cascade | |
| created_by | uuid not null → auth.users(id) on delete cascade | 生成収支の created_by に使う |
| type | transaction_type not null | income / expense |
| amount | integer not null check (amount >= 1) | |
| category_id | uuid → categories(id) on delete set null | |
| memo | text | |
| is_active | boolean not null default true | 一時停止できる |
| created_at | timestamptz not null default now() | |

### `transactions` への追加

- `recurring_id uuid → recurring_transactions(id) on delete set null`：生成元の追跡と冪等性に使う。
  ルール削除時は `set null` とし、過去に生成された収支は履歴として残す。
- 部分ユニークインデックス `(recurring_id, date) where recurring_id is not null`：
  同一ルール × 同一期間開始日の二重生成を DB レベルで防止する。

### 入出力の型

- `RecurringTransaction = Tables["recurring_transactions"]["Row"]`（`types/index.ts`）
- 入力バリデーション `recurringTransactionSchema`（`lib/validations/transaction.ts`）：
  `type` / `amount`（四則演算式を `evaluateAmount` で評価）/ `category_id?` / `memo?` / `is_active`。
  `date` は持たない。

## UI の動作・バリデーション

- `/transactions/recurring`：household 全員の定期項目を一覧表示し、登録者名を併記する。
  編集・削除・有効/無効トグルは `created_by === user.id` の行のみ操作可能。
- フォーム（`recurring-form.tsx`）は収支フォームを踏襲。種別トグル・金額（式評価）・カテゴリ・メモ・
  有効トグルを持ち、日付欄は持たない。
- 定期項目の作成時、当期分の収支を即時生成する（次期を待たずに反映。UX 重視）。

## Supabase テーブル・RLS ポリシー

`recurring_transactions`：

- SELECT: `is_household_member(household_id)`
- INSERT: `is_household_member(household_id) and created_by = auth.uid()`
- UPDATE / DELETE: `created_by = auth.uid()`

### SECURITY DEFINER 関数 `generate_due_recurring(_household_id uuid) returns integer`

- `is_household_member(_household_id)` を検証（false なら 0）。
- `households.period_start_day` を読み、関数内で当期の開始日を算出する
  （`date_trunc('month', current_date) + (start_day-1)`、`current_date` がそれより前なら 1 か月戻す）。
  日付を引数で受け取らないのは、メンバーが任意日付を渡して別期間の生成を強制できないようにするため。
- 当該 household の `is_active = true` の各ルールについて、`date = 当期開始日`・
  `recurring_id = ルール id`・`created_by = ルール created_by` で `transactions` に INSERT する。
  `on conflict (recurring_id, date) do nothing` で冪等。
- `security definer` のため、呼び出し者と異なる `created_by` でも INSERT できる
  （`transactions` の INSERT ポリシーを安全にバイパス）。既存の `transfer_ownership` /
  `set_member_display_name` と同じ設計方針。

## 未解決の課題

- 定期項目の作成時に当期分を即時生成する仕様を採用（次期から生成にもできる）。
- 過去期間へのバックフィルは行わない（当期のみ）。
- 将来的に Vercel Cron による事前生成を足す余地あり（本実装の RPC をそのまま流用可能）。
