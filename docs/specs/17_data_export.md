# データエクスポート（CSV出力）仕様書

## 概要

収支データを**外部ファイル（CSV）としてダウンロード**できる機能。蓄積した家計データを
表計算ソフト（Excel / スプレッドシート）でのバックアップ・再集計に持ち出せるようにする。

- 収支一覧ページ（`/transactions`）で**現在表示中の期間**をそのまま CSV に出力する。
- 形式は CSV のみ。追加ライブラリは使わず自前生成する。Excel での文字化けを防ぐため UTF-8 + BOM。
- 認可（household スコープ）をサーバー側に閉じ込めるため **Route Handler（GET）** で生成する。

## 対象ユーザー・前提条件

- ログイン済みかつアクティブな household に所属しているユーザー。
- 出力対象は `getActiveHouseholdId()` で解決した household の取引のみ（多層防御でスコープ）。
- マイグレーション不要（既存テーブルの読み取りのみ。新規テーブル・カラムなし）。

## 画面・UI

`/transactions` ページのヘッダー（「収支を追加」ボタンの隣）に「CSV出力」リンクを追加する。

- `lucide-react` の `Download` アイコン付き、`buttonVariants({ variant: "outline", size: "sm" })`。
- リンク先は `GET /transactions/export?ref=<表示中の期間の開始日>`。`ref` には `toISODate(range.start)`
  を渡し、画面に表示している期間と完全に一致させる。
- 取引が0件の期間でもボタンは表示し、ヘッダー行のみの CSV を返す（挙動を一貫させる）。

## データモデル（CSV 仕様）

| 列 | 内容 | null/欠損時 |
| --- | --- | --- |
| 日付 | `transactions.date`（`YYYY-MM-DD`） | — |
| 種別 | `収入` / `支出`（`type` を日本語化） | — |
| カテゴリ | `categories.name` | `未分類` |
| 金額 | 数値のみ（`¥`・符号なし） | — |
| メモ | `transactions.memo` | 空文字 |
| 登録者 | `profiles.display_name`（`created_by` から解決） | `不明` |

- 並び順: **日付の昇順**（台帳として自然。一覧ページは降順だが出力は昇順で固定）。
- エスケープ: 値に `,` `"` 改行 を含む場合は `"` で囲み、内部の `"` は `""` に二重化（RFC4180）。
- 文字コード: 先頭に UTF-8 BOM（`﻿`）を付与。
- ファイル名: `transactions_<開始日>_<最終日>.csv`（例 `transactions_2026-06-01_2026-06-30.csv`）。

## Supabase

- 新規 RLS・テーブルなし。既存の取引取得 RLS（`household_members` に自分が居る household のみ）に従う。
- アプリ側でも `household_id` + 日付範囲でスコープして多層防御する（`user_id` 単体取得は禁止の方針通り）。

## 実装

### `lib/export.ts`（純関数・テスト対象）

```ts
export type ExportRow = {
  date: string;
  type: "income" | "expense";
  categoryName: string | null;
  amount: number;
  memo: string | null;
  memberName: string | null;
};
export function toTransactionsCsv(rows: ExportRow[]): string;
```

- ヘッダー + 各行を組み立て、先頭に BOM を付けて返す。内部に `escapeCsvField()` を持つ。

### Route Handler `app/(dashboard)/transactions/export/route.ts`

- `transactions/page.tsx` と同じ流れ: 認証 → `getActiveHouseholdId()` → `period_start_day` 取得
  → `getPeriodRange()` → `household_id` + `gte/lt date` で取引取得。
- 登録者名は `dashboard/page.tsx` の2段 join（`household_members` → `profiles`）を再利用。
- 整形した `ExportRow[]`（日付昇順）を `toTransactionsCsv()` に渡し、
  `Content-Type: text/csv; charset=utf-8` と `Content-Disposition: attachment; filename=...` で返す。
- 未ログインは 401、household 未解決は 403。

## テスト

- Unit（`lib/export.test.ts`）: ヘッダー行・種別の日本語化・金額が数値のみ・null フォールバック
  （未分類 / 不明 / 空メモ）・カンマ/クオート/改行のエスケープ・BOM 付与・空配列でヘッダーのみ。
- E2E（`e2e/transactions-export.spec.ts`）: グループ作成 → 収支1件登録 → 「CSV出力」クリック →
  `page.waitForEvent("download")` でダウンロード捕捉 → ファイル名が `transactions_` 始まり・
  中身に金額/カテゴリ名が含まれることを検証（使い捨てグループなので安全）。

## 未解決の課題

- Excel(.xlsx)・JSON 形式は今回スコープ外（必要になれば別途追加）。
- メンバー別・カテゴリ別など期間以外の絞り込みは収支ページに無いため未対応。
  将来フィルターが増えた場合は同じ `ref` 同様にクエリパラメータで引き継ぐ。
