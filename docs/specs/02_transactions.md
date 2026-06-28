# 収支記録（CRUD） 仕様書

## 概要

家計簿グループの収支（収入/支出）を記録・閲覧・編集・削除する。本アプリの中核機能。
一覧は「月単位」で表示するが、月の区切りは暦月固定ではなく **household ごとに開始日を指定**できる（締め日モデル）。

## 対象ユーザー・前提条件

- ログイン済みかつアクティブな household を選択しているメンバーが対象
- 収支の追加・閲覧は household の全メンバーが可能
- 収支の編集・削除は **登録者本人（`created_by = auth.uid()`）のみ**
- すべての取得・更新は `household_id` でスコープ（`lib/household.ts#getActiveHouseholdId`）。未選択なら `/households` へ誘導
- 金額（`amount`）は円建てのため整数（小数なし）

## 月の区切り（期間）

- household の `period_start_day`（1〜28, デフォルト 1）で期間の開始日を決める
- 期間は `[開始日, 翌月の開始日)` の半開区間。例:
  - `period_start_day=1` → 2026/06/01 〜 06/30（暦月、`< 2026/07/01`）
  - `period_start_day=25` → 2026/05/25 〜 06/24（`< 2026/06/25`）
- 31/30 始まりは短い月で消失するため開始日は **1〜28 に制限**
- 設定変更は **owner のみ**（`/households` のグループカードに開始日設定欄）

## 画面・UI

### 表示内容

- `/transactions`: 月（期間）ナビ「◀ 2026/06/01〜06/30 ▶」＋ その期間の収支を `date desc, created_at desc` で一覧。
  各行に 日付・カテゴリ（色付き）・メモ・金額（収入=緑/支出=赤）・登録者（自分/他メンバー）。
  期間の 収入計・支出計・収支差 を表示。各行に編集/削除（本人の行のみ）。
- `/transactions/new`: 追加フォーム。`?date=YYYY-MM-DD` を受け取ると日付の初期値に採用する（不正値・未指定なら今日）。ダッシュボードで当期以外を表示中に「記録する」を押すと、その期間の開始日が引き継がれる
- `/transactions/[id]/edit`: 編集フォーム（本人のみ。他人の行はアクセス時に一覧へ戻す）
- 共通フォーム: `components/features/transactions/transaction-form.tsx`
- 期間ナビ: `components/features/transactions/month-nav.tsx`（クエリ `?ref=YYYY-MM-DD` で対象期間を保持）

### インタラクション・バリデーション

- `type`: `income` | `expense`（必須、トグル）
- `amount`: 整数・1以上（`z.coerce.number().int().min(1)`）
- `date`: `YYYY-MM-DD`（必須、未来日も許可）
- `category_id`: 任意（`type` に適合するカテゴリのみ選択肢に出す。ネイティブ `<select>`）
- `memo`: 任意・200字以内
- 送信は Server Action（`useActionState`）。エラーは `role="alert"` 表示
- 成功後 `revalidatePath` + `/transactions` へ `redirect`

#### 連続登録（新規登録フォームのみ）

- `/transactions/new` では送信ボタンを2つ表示する（`enableContinue` prop で切り替え。編集フォームは1つのまま）
  - 「登録する」: 従来通り。登録後 `/transactions` へ `redirect`
  - 「登録して続ける」: submit ボタンの `name="_continue" value="1"` で連続登録を伝える。`createTransaction` は redirect せず `{ ok: true, key }` を返す（`key` は `crypto.randomUUID()`。連続成功のたびに変わりクライアントのリセットを毎回トリガー）
- 「登録して続ける」成功後はフォームに留まり、**金額・カテゴリ・メモをクリア**し、**日付・種別は維持**、金額欄へフォーカスする（次のレシートを続けて入力しやすくする）
- 成功フィードバックは `role="status"` の領域に「N件登録しました（続けて入力できます）」を表示（件数はフォーム内でカウント）

## 関連機能（同一フォーム・ページ群を拡張）

収支記録を中核に、以下の機能が `TransactionForm` / `/transactions` 配下を拡張する。詳細は各仕様書を参照。

- **金額の四則演算入力** … 25_amount_expression.md（金額欄に式を入力し四捨五入して登録）
- **定期収支** … 26_recurring_transactions.md（`/transactions/recurring`・`recurring_id`・閲覧時に冪等生成）
- **レシートOCR入力補助** … 27_receipt_ocr.md（画像から金額・日付をプリフィル）
- **グループ間反映** … 28_cross_group_reflection.md（他の所属グループへ一回限りコピー）
- **カレンダービュー** … 29_calendar_view.md（`/calendar`・暦月で収支を俯瞰）
- **CSV出力** … 17_data_export.md / **Excelインポート** … 21_data_import.md

## データモデル

### 入力

```typescript
// lib/validations/transaction.ts
const transactionSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.coerce.number().int().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category_id: z.string().uuid().optional().or(z.literal("")),
  memo: z.string().max(200).optional(),
});

// lib/validations/household.ts（追記）
const periodStartDaySchema = z.object({
  periodStartDay: z.coerce.number().int().min(1).max(28),
});
```

### 出力

```typescript
// app/(dashboard)/transactions/actions.ts
type TransactionActionState = { error: string } | undefined;

// lib/period.ts
type PeriodRange = { start: Date; end: Date }; // start <= date < end
getPeriodRange(refDate: Date, startDay: number): PeriodRange
shiftPeriod(range: PeriodRange, delta: number, startDay: number): PeriodRange
formatPeriodLabel(range: PeriodRange): string
```

## Supabase

### 使用テーブル

```sql
transactions(id, household_id, created_by, amount:int, type['income'|'expense'],
             category_id, date, memo, created_at,
             recurring_id)  -- 26 で追加: 生成元の定期収支（on delete set null）。手入力は null
categories(id, household_id, name, color, icon, type, is_default)
households(... , period_start_day:int default 1 check 1..28)  -- 0008 で追加
```

### RLS ポリシー（既存）

- `transactions` select: `is_household_member(household_id)`
- `transactions` insert: メンバー かつ `created_by = auth.uid()`
- `transactions` update/delete: `created_by = auth.uid()` のみ
- `households` update（period_start_day の変更）: owner のみ

### クエリ / Server Action

```typescript
// 一覧取得（Server Component）
supabase.from("transactions")
  .select("*, category:categories(name, color)")
  .eq("household_id", activeId)
  .gte("date", isoStart).lt("date", isoEnd)
  .order("date", { ascending: false })
  .order("created_at", { ascending: false });

// actions
createTransaction(formData)   // household_id + created_by を付与して insert
updateTransaction(formData)   // 本人の行のみ（RLS）
deleteTransaction(formData)   // 本人の行のみ（RLS）
setPeriodStartDay(formData)   // owner のみ。households.period_start_day を更新
```

## テスト

- Unit: `lib/period.ts`（月末・うるう年・前後移動）、`lib/validations/transaction.ts`
- Component: `TransactionForm`（収支トグル・金額・日付・カテゴリ）、`MonthNav`
- E2E: 追加 → 一覧に表示 → 編集で金額反映 → 削除で消える（storageState 認証）

## 未解決の課題

- 一覧のページネーション（期間区切りで件数は限定的なため当面不要）
- 一覧上での絞り込み（メンバー別・カテゴリ別）。メンバー別の集計はダッシュボード 03 / メンバー別アクティビティ 07 で対応済み

> 登録者の表示名は `profiles`（07）/ グループ毎ニックネーム（22）で解決済み。
