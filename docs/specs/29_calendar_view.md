# カレンダービュー 仕様書

## 概要

収支を暦月のカレンダー上で俯瞰できる新ページ `/calendar` を追加する。現状は収支の閲覧が「収支リスト（期間ナビ）」と「分析（集計）」のみで、日々の支出の偏りや特定の日の収支を直感的に把握する手段がない。カレンダービューにより、月内の収支分布を一目で確認し、気になる日をタップしてその日の明細を確認できるようにする。

## 対象ユーザー・前提条件

- ログイン済みかつ家計簿グループ（household）を選択済みのユーザー。
- 未ログインは `/login`、グループ未選択は `/households` へリダイレクト（他ダッシュボードページと同じ）。
- 表示対象は現在の `household_id` にスコープされた収支のみ。

## 画面・UI

### 表示内容

- `PageHeader`（eyebrow="記録" / title="カレンダー"）。
- 月ナビ（`MonthNav`）: 「2026年6月」のような月ラベルと前月/翌月ボタン。
- 月合計サマリー（`SummaryCards`）: 当月の収入・支出合計。
- カレンダー本体（`CalendarBoard`）:
  - 曜日ヘッダー（日 月 火 水 木 金 土、日曜始まり）。
  - 7列グリッド。各日セルに日番号と、その日の収入/支出合計を表示。
  - 当月外の日（前後の月の埋め日）は淡色表示。今日・選択中の日はハイライト。
- 選択日の明細リスト: カレンダー下部に、選択した日の収支を `CategoryBadge` ＋ 金額 ＋ メモで一覧表示。各行は `/transactions/[id]/edit` へのリンク。明細がない日は空状態を表示。

### インタラクション・バリデーション

- 期間区切りは**暦通りの月**（1日〜末日）。締め日（`period_start_day`）ベース期間とは独立。
- 月ナビは `?ref=YYYY-MM-DD` の URL リンクで遷移（サーバー再描画）。`ref` 不正・未指定時は今日基準。
- 日の選択はクライアント state で即時切替（ページ遷移なし）。初期選択日は当月内なら今日、当月外（過去/未来月閲覧時）なら当月1日。
- グリッドは常に完全な週単位（前月日曜〜翌月土曜を埋める）。

## データモデル

### 入力

```typescript
// URL 検索パラメータ
type SearchParams = { ref?: string }; // "YYYY-MM-DD"

// CalendarBoard props
type CalendarDay = {
  date: string;      // "YYYY-MM-DD"
  inMonth: boolean;  // 当月か（埋め日は false）
  income: number;
  expense: number;
};
type CalendarBoardProps = {
  weeks: CalendarDay[][];                        // 週 × 日
  transactionsByDate: Record<string, TxRow[]>;   // 当月分の日別明細
  initialSelected: string;                       // "YYYY-MM-DD"
};
```

### 出力

```typescript
// lib/calendar.ts の主な関数
function getCalendarMonthRange(ref: Date): { start: Date; end: Date }; // 当月1日〜翌月1日（半開）
function getCalendarGridRange(ref: Date): { start: Date; end: Date };  // 表示グリッド範囲（完全週・半開）
function summarizeDailyTotals(
  txs: { date: string; type: "income" | "expense"; amount: number }[],
): Map<string, { income: number; expense: number }>;
function buildCalendarWeeks(
  ref: Date,
  totals: Map<string, { income: number; expense: number }>,
): CalendarDay[][];
function shiftMonth(ref: Date, delta: number): Date;
function formatMonthLabel(ref: Date): string; // "2026年6月"
```

## Supabase

### 使用テーブル

- `transactions`（読み取りのみ）。`category:categories(name, color)` を結合。
- `households`（`period_start_day` 等の設定取得はカレンダーでは不要だが、認証/グループ確認は既存ヘルパーを利用）。

### RLS ポリシー

- 既存の `transactions` ポリシー（`household_members` に自分が属する `household_id` のみ参照可）をそのまま利用。新規ポリシー追加なし。

### クエリ / Server Action

```typescript
// 表示グリッド範囲の収支を取得（既存 transactions ページと同じ select）
const { data } = await supabase
  .from("transactions")
  .select("id, amount, type, date, memo, created_by, category:categories(name, color)")
  .eq("household_id", householdId)
  .gte("date", isoGridStart)
  .lt("date", isoGridEnd)
  .order("date", { ascending: true })
  .order("created_at", { ascending: true });
```

新規 Server Action は追加しない（読み取り専用ページ）。DB スキーマ・マイグレーション変更なし。

## 未解決の課題

- モバイル下部タブが5個になる（ホーム/収支/カレンダー/分析/メンバー）。レイアウト崩れがないか実機幅で確認する。
- 1日の明細件数が多い場合のセル内合計表示の省略・折返し方針（初版は合計のみ表示で対応）。
