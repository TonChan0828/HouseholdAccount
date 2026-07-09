# 月末未記録リマインダー 仕様書

## 概要

家計簿グループに当期（締め日区切りの期間）中まだ一件も収支が記録されていない状態で、期末が近づいたときにダッシュボード上で気づけるようにする。プッシュ通知・メール送信のインフラは存在しないため、ダッシュボード訪問時にサーバー側で条件判定し、条件を満たす場合のみバナーカードを描画する「訪問時判定」方式を採る（`ensureRecurringGenerated` の遅延生成、`ForecastCard` の `viewingCurrent` 判定と同じ思想）。

## 対象ユーザー・前提条件

- 家計簿グループに所属する認証済みユーザー（`role` を問わない）
- ダッシュボード（`/dashboard`）で **当期** を表示しているとき（`?ref=` で過去/未来期間を表示しているときは対象外）

## 画面・UI

### 表示内容

- ダッシュボードのサイドカラム、月末着地予測カード（`ForecastCard`）の直上に、条件を満たす場合のみ警告バナーカードを表示する
- 文言例: 「今月はまだ収支が登録されていません。月末まで残り{daysRemaining}日です。」
- 配色は `lib/advice.ts` の `warn` severity と同じトーン（`bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400` + `TriangleAlert` アイコン）
- 「収支を記録」CTA ボタンを設置し、ダッシュボードの「記録する」導線と同じ `newTransactionHref`（当期表示中は日付パラメータなし）へリンクする
- `data-testid="no-transactions-reminder"` を付与する

### インタラクション・バリデーション

- 閉じる（dismiss）機能は持たない。条件を満たす限り訪問のたびに表示され、1件でも収支が登録されれば自然に非表示になる
- 表示条件（すべて満たす場合のみ表示）:
  1. 当期を閲覧している（`viewingCurrent === true`）
  2. 当期のグループ全体の取引件数が 0 件（`ScopeToggle` の「自分のみ」フィルタの影響を受けない。記帳漏れの判定はグループ全体で行うべきため）
  3. 当期の残り日数が 3 日以内（`daysRemaining <= 3`。`lib/forecast.ts#buildForecast` が返す値と同じフィールド・同じ意味論を再利用し、`ForecastCard` の「残りN日」表示との表記ズレを避ける）

## データモデル

新規テーブル・カラムは不要。既存の `transactions`（当期件数）と `households.period_start_day`（期間境界の計算に使用）のみを利用する。

### 入力

```typescript
export type ReminderInput = {
  viewingCurrent: boolean;
  transactionCount: number;
  daysRemaining: number;
};
```

### 出力

```typescript
// shouldShowNoTransactionsReminder(input: ReminderInput): boolean
```

## Supabase

### 使用テーブル

- `transactions`（当期範囲の件数カウントに使用。ダッシュボードで既に取得済みの配列の `.length` を利用するため新規クエリは追加しない）
- `households`（`period_start_day` は既存の `getHouseholdSettings` 経由で取得済みのものを利用）

### RLS ポリシー

新規ポリシー不要。既存の `transactions` RLS（`household_members` に自分の `user_id` が存在する `household_id` のデータのみ操作可能）をそのまま利用する。

### クエリ / Server Action

新規クエリ・Server Action は不要。`app/(dashboard)/dashboard/page.tsx` が既に取得している当期 `transactions` 配列と、既に計算済みの `forecast.daysRemaining` / `viewingCurrent` を使い、`lib/reminder.ts#shouldShowNoTransactionsReminder` で真偽判定するのみ。

```typescript
export const NO_TRANSACTIONS_REMINDER_THRESHOLD_DAYS = 3;

export function shouldShowNoTransactionsReminder(input: ReminderInput): boolean {
  return (
    input.viewingCurrent &&
    input.transactionCount === 0 &&
    input.daysRemaining <= NO_TRANSACTIONS_REMINDER_THRESHOLD_DAYS
  );
}
```

## 未解決の課題

- 真にプッシュ通知・メール通知として届けたい場合は、Vercel Cron などのバッチ実行基盤と email/push 送信手段が別途必要になる（現状は「訪問時にしか気づけない」制約が残る）。将来必要になった場合の拡張課題とする
- メンバー個別の記帳有無（例: 自分だけ未記帳）を判定する機能は本仕様の対象外。あくまでグループ全体の当期記録有無のみを見る
