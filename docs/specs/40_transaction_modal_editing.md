# 収支のモーダル編集・追加 仕様書

## 概要

収支の編集・追加を、ページ遷移せずその場のダイアログ（モーダル）で完結できるようにする。

従来は編集のたびに `/transactions` → `/transactions/[id]/edit` → `/transactions` と2回の
フルページ遷移が発生し、編集ページを開くたびに `transactions` 1件・`categories`・
`getUserHouseholds()` を再取得していた。一方、一覧・カレンダー・ダッシュボードは編集に必要な
値（金額・日付・カテゴリ・メモ・`is_shared`・`created_by`）をすでに取得済みである。
この既取得データを使ってダイアログを開くことで、「開く」操作のサーバー往復を 0 にし、
保存時のみ Server Action + `revalidatePath` の 1 往復で済ませる。

## 対象ユーザー・前提条件

- 家計簿グループに所属する認証済みユーザー
- 編集できるのは入力者本人と名義人の収支のみ（`created_by = auth.uid() or on_behalf_of = auth.uid()`。spec 41 で名義人に拡張）
- JavaScript 無効時・ディープリンク用に `/transactions/[id]/edit` ページは従来どおり残す

## 画面・UI

### 適用範囲

| 画面 | 従来 | 変更後 |
| --- | --- | --- |
| `/transactions` 一覧の編集ペンアイコン | `/transactions/[id]/edit` へ遷移 | 編集ダイアログを開く |
| `/transactions` の「収支を追加」 | `/transactions/new` へ遷移 | 追加ダイアログを開く |
| `/calendar` の日別明細の行 | `/transactions/[id]/edit` へ遷移 | 自分の記録なら編集ダイアログ、他メンバーの記録は非操作 |
| `/dashboard` の「最近の取引」 | 編集導線なし | 自分の記録に編集ダイアログの導線を新設 |
| `/transactions/[id]/edit`・`/transactions/new` | ページ | 変更なし（フォールバックとして維持） |

`app/demo/**`（デモモード）は別実装（インメモリ）のため対象外。

### ダイアログの内容

- タイトル: 「収支を編集」／「収支を追加」
- 本文: 既存の `TransactionForm` をそのまま再利用する。**ページ版の機能はすべて維持する**:
  - 追加時: 「登録して続ける」（閉じずに連続入力）、「他のグループにも反映する」（登録と同時にコピー）、
    レシートOCRの導線
  - 編集時: 上記3つは出さない（編集に同時反映は無く、連続入力・OCRも不要）
- 編集時のみ、フォーム下に既存の `ReflectToGroups`（他のグループへ後追い反映）を表示する
- 編集時のみ、最下部に `/transactions/[id]/edit` への「編集ページを開く」リンクを置く
  （削除はこのページ、または一覧行のゴミ箱ボタンから行う）
- 長いフォーム（種別/金額/日付/カテゴリ/メモ/精算/反映）がモバイルでも収まるよう、
  `DialogContent` に `max-h-[85vh] overflow-y-auto` を付ける
- `data-testid="transaction-dialog"` を付与する

### インタラクション・バリデーション

- 保存に成功したらダイアログを閉じ、背後の一覧・カレンダー・ダッシュボードが最新値に更新される
  （Server Action の `revalidatePath` により RSC が部分再描画される）
- 保存に失敗したらダイアログは開いたままエラーメッセージを表示する（入力値は保持）
- バリデーション規則は既存の `lib/validations/transaction.ts` と同一（変更なし）
- 削除はダイアログに置かない（一覧行のゴミ箱ボタン／編集ページを使う）

## データモデル

### ダイアログに渡す値（すべてページで取得済み）

```typescript
// components/features/transactions/transaction-dialog.tsx
export type DialogTransaction = {
  id: string;
  type: "income" | "expense";
  amount: number;
  date: string;
  category_id: string | null;
  memo: string | null;
  is_shared: boolean;
};

type ProviderProps = {
  categories: CategoryOption[];
  otherHouseholds: { id: string; name: string }[];
  children: React.ReactNode;
};
```

`CategoryOption` は新設の共通取得ヘルパーが返す型:

```typescript
// lib/queries/categories.ts
export type CategoryOption = Pick<Category, "id" | "name" | "color" | "type">;
export function fetchHouseholdCategories(
  supabase: ServerClient,
  householdId: string,
): Promise<CategoryOption[]>;
```

`TransactionForm` の `categories` プロップも `Category[]` から `CategoryOption[]` に緩める
（フォームが使うのは `id/name/color/type` のみ）。

### `CalendarTx` の拡張

カレンダーの明細から編集ダイアログを開くため、`components/features/calendar/calendar-board.tsx`
の `CalendarTx` に `date` / `category_id` / `created_by` / `is_shared` を追加する。

## Supabase

### 使用テーブル

- `transactions`・`categories`（いずれも既存）。**テーブル・RLS ポリシーの変更はなし**
- マイグレーションなし

### Server Action

`app/(dashboard)/transactions/actions.ts` の `createTransaction` / `updateTransaction` に
「ダイアログからの送信」を示す hidden input `_dialog` を追加する（既存の `_continue` と同じパターン）。

```typescript
// ダイアログ送信時は redirect せず成功 state を返し、クライアントがダイアログを閉じる
if (formData.get("_dialog") === "1") {
  return { ok: true, key: crypto.randomUUID() };
}
redirect("/transactions");
```

`revalidatePath` の対象は `/transactions` のみとする。ダイアログは3画面に出るが、Server Action は
呼び出し元のルートを自動で再描画するため、閉じた直後の表示はそれで最新になる。
`/dashboard`・`/calendar` を明示的に足すと、収支を書き込むたびに未訪問ルートまで無効化されて
開発サーバの再コンパイルが多発し、アプリ全体が約30倍遅くなる回帰を招いたため対象にしない。

認可は従来どおり Server Action 側で担保する（`requireDashboardContext` + `household_id` スコープ
+ RLS）。クライアントから渡る `id` を信用しない点も変更なし。

## 未解決の課題

- デモモード（`app/demo/**`）は従来どおりページ遷移のまま。機能パリティは今回対象外
- 編集ダイアログを開いている間に他メンバーが同じ収支を更新した場合の競合検知は行わない
  （後勝ち。従来の編集ページと同じ挙動）
- 定期収支（`/transactions/recurring`）の編集は今回のモーダル化対象外
