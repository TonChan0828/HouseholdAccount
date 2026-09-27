# カテゴリ別登録漏れリマインダー 仕様書

## 概要

ユーザーが「毎月必ず記録したい」と指定したカテゴリ（例: 家賃・給与など）ごとに、当期まだ1件も
登録がない場合を検知してダッシュボードで警告する。判定タイミングは「当期の残り日数3日以内」とする。

## 対象ユーザー・前提条件

- 家計簿グループに所属する認証済みユーザー
- 通知対象カテゴリの指定はグループ共有設定（`categories` テーブルに紐づく。ユーザー個別設定ではない）
- ダッシュボードで当期を表示しているとき（`viewingCurrent === true`）のみ対象

## 画面・UI

### 設定画面（`/categories` に組み込み）

- 各カテゴリ行（デフォルト・カスタム問わず）に「通知ON/通知OFF」トグルボタンを追加する
- 既存の定期収支「停止/再開」ボタンと同じ実装パターン（hidden input で次の値を渡す submit フォーム。
  このアプリに onChange 自動保存トグルの前例がないため、既存パターンに合わせる）
- デフォルトカテゴリの行にも表示する（名前・色・種別の編集不可とは別軸のため、`is_default` による
  保護とは矛盾しない）
- ページヘッダー直下にトグルの意味を説明するノートを常時表示する（機能の発見性向上）:
  - Bell アイコン + 「通知ONにすると、締め日の3日前までにそのカテゴリの登録が無い場合、
    ダッシュボードでお知らせします」
  - `data-testid="category-reminder-note"` を付与する

### ダッシュボード表示

- 当期表示中・残り日数3日以内・かつ「通知ON」のカテゴリのうち当期の取引件数が0件のものが1件以上
  あるとき、1枚のカードにまとめて列挙する
- 表示場所: ダッシュボードのサイドカラム、`ForecastCard`（月末着地予測）の直上
- 見た目: 警告として一目で分かるよう amber の枠線 + 薄い amber 背景で他カードと差別化する
  （ライト: `border-amber-300 bg-amber-50`、ダーク: `border-amber-500/40 bg-amber-500/10` 相当）
- ヘッダー行に「残りn日」バッジを表示する（`daysRemaining` を props で受け取る）
- 文言例: 「次のカテゴリは今月まだ登録がありません」+ カテゴリ名のバッジ列挙
- 「収支を記録」CTA を設置する（既存の `newTransactionHref` を再利用。カテゴリ指定の事前入力は行わない）
- `data-testid="unrecorded-categories-reminder"` を付与する
- 閉じる（dismiss）機能は持たない（登録すれば自然に消える）

### インタラクション・バリデーション

- 通知トグルの変更はメンバー全員が操作可能（カテゴリ管理権限と同じ。owner限定にしない）
- 表示条件（すべて満たす場合のみ表示）:
  1. 当期を閲覧している（`viewingCurrent === true`）
  2. 当期の残り日数が3日以内（`daysRemaining <= NO_TRANSACTIONS_REMINDER_THRESHOLD_DAYS`）
  3. `reminder_enabled = true` のカテゴリのうち、当期のグループ全体の取引件数が0件のものが1件以上

## データモデル

### 入力

```typescript
export const NO_TRANSACTIONS_REMINDER_THRESHOLD_DAYS = 3;

export type CategoryReminderTarget = { id: string; name: string };

export type CategoryReminderInput = {
  viewingCurrent: boolean;
  daysRemaining: number;
  targets: CategoryReminderTarget[];
  countByCategoryId: Record<string, number>;
};
```

### 出力

```typescript
// getUnrecordedReminderCategories(input: CategoryReminderInput): CategoryReminderTarget[]
```

### `categories` テーブルへのカラム追加

```typescript
// types/index.ts の Category に reminder_enabled: boolean が追加される
```

## Supabase

### 使用テーブル

- `categories`: `reminder_enabled boolean not null default false` を追加
- `transactions`: 当期の取引件数集計に使用（ダッシュボードで取得済みの配列を再利用。新規クエリ不要）

### マイグレーション

`supabase/migrations/0022_category_reminder.sql`

```sql
alter table public.categories
  add column reminder_enabled boolean not null default false;
```

RLS ポリシーの変更は不要（既存の `categories` ポリシーが全カラムをカバーする）。

### クエリ / Server Action

```typescript
// app/(dashboard)/categories/actions.ts に追加
// toggleCategoryReminder(formData): household_id のみでスコープ（is_default 制限なし）
export async function toggleCategoryReminder(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const reminderEnabled = formData.get("reminder_enabled") === "true";
  const { householdId, supabase } = await requireDashboardContext();
  await supabase
    .from("categories")
    .update({ reminder_enabled: reminderEnabled })
    .eq("id", id)
    .eq("household_id", householdId);
  revalidatePath("/categories");
}
```

ダッシュボード側は既存の `app/(dashboard)/dashboard/page.tsx` に以下を追加する:

```typescript
// 通知対象カテゴリ一覧（新規クエリ）
const { data: reminderCategories } = await supabase
  .from("categories")
  .select("id, name")
  .eq("household_id", householdId)
  .eq("reminder_enabled", true);

// 当期取引のカテゴリ別件数（新規クエリ不要。既存の transactions 配列から集計）
const countByCategoryId: Record<string, number> = {};
for (const t of transactions) {
  if (!t.category_id) continue;
  countByCategoryId[t.category_id] = (countByCategoryId[t.category_id] ?? 0) + 1;
}
```

## 表示方針

- 通知対象カテゴリは件数上限を設けず全件表示し、カテゴリチップを幅に応じて折り返す。
  空白を含まない長いカテゴリ名もカード幅を超えないよう折り返す。情報を隠さないことを優先し、
  上限・省略・ページングは現時点では導入しない。
