# 収支のグループ間反映（cross-group reflection）仕様書

## 概要

あるグループに記帳した収支を、ログイン中ユーザーが所属する他の家計簿グループにもコピー（反映）する機能。
同じ支出/収入を複数グループで管理したいケース（例: 個人用グループと家族用グループの両方に同じ買い物を残す）に対応する。

反映は **一回限りのコピー**であり、反映元と反映先はリンクしない（元を編集・削除しても反映先には伝播しない）。
このためデータベースのスキーマ変更は不要。

## 対象ユーザー・前提条件

- ログイン済みで、**2 つ以上の家計簿グループに所属している**ユーザー。
- 反映元はアクティブグループ（`getActiveHouseholdId()`）。反映先候補は反映元を除く自分の所属グループのみ。
- 所属が 1 グループのみの場合、反映 UI は表示しない。

## 画面・UI

### 表示内容

- **新規登録フォーム**（`/transactions/new`）: 既存フォーム下部に「他のグループにも反映する」開閉セクションを追加し、反映先グループをチェックボックスで複数選択できる。
- **編集画面**（`/transactions/[id]/edit`）: 既存の編集/削除フォームの近くに「他のグループへ反映」セクション（専用フォーム）を追加。チェックボックス＋「選択したグループへ反映」ボタン。

### インタラクション・バリデーション

- 反映先グループは 0 個以上選択可。0 個なら反映処理はスキップ（新規登録は通常どおり 1 グループのみ登録）。
- 送信された反映先 ID は**サーバー側で本人の所属グループに絞り込む**（クライアントを信用しない）。不正・非所属の ID は黙って除外。
- カテゴリは反映先グループで `名前（大文字小文字無視）+ type` が一致するものに紐付ける。一致が無ければ `category_id = null`（未分類）。**新規カテゴリは作成しない**。
- 後追い反映の結果は「N グループに反映しました」/ エラーメッセージで表示する。

## データモデル

### 入力

```typescript
// フォーム送信（FormData）
// 新規登録: 既存フィールド + reflect_household_ids（複数可）
// 後追い反映: id + reflect_household_ids（複数可）

// 純関数 buildMirrorRows の入力（lib/transactions/mirror.ts）
type MirrorSource = {
  type: "income" | "expense";
  amount: number;
  date: string; // YYYY-MM-DD
  categoryName: string | null; // 反映元カテゴリ名（null=未分類）
  memo: string | null;
};
type MirrorTarget = {
  householdId: string;
  categories: { id: string; name: string; type: "income" | "expense" | "both" }[];
};
```

### 出力

```typescript
// buildMirrorRows の出力（transactions.insert 用の行）
type MirrorRow = {
  household_id: string;
  created_by: string;
  type: "income" | "expense";
  amount: number;
  date: string;
  category_id: string | null; // 名前+type 一致で解決、無ければ null
  memo: string | null;
};

// reflectTransaction の戻り値
type ReflectState =
  | { ok: true; count: number }
  | { error: string }
  | undefined;
```

## Supabase

### 使用テーブル

- `transactions` — 反映行を一括 insert（反映先 household_id・本人 created_by）。
- `categories` — 反映先グループのカテゴリを取得し名前+type で照合。
- `household_members` — 反映先候補・本人所属の検証（`getUserHouseholds()` 経由）。

### RLS ポリシー

- 変更なし。`transactions` の INSERT ポリシー `is_household_member(household_id) and created_by = auth.uid()` を満たす（反映先は本人所属グループのみ・created_by は本人）。
- `categories` の SELECT は `is_household_member(household_id)`。本人所属グループのみ取得可能。

### クエリ / Server Action

```typescript
// lib/transactions/mirror.ts（純関数・テスト対象）
export function buildMirrorRows(
  source: MirrorSource,
  userId: string,
  targets: MirrorTarget[],
): MirrorRow[]; // splitCategoryNames / categoryKey を内部利用

// app/(dashboard)/transactions/actions.ts
// 非公開ヘルパー: 反映先 ID を所属グループに絞り、カテゴリを取得し buildMirrorRows → insert
async function mirrorTransaction(supabase, userId, source, targetIds): Promise<number>;

// createTransaction: source 登録後、reflect_household_ids があれば mirrorTransaction を呼ぶ
// reflectTransaction(prev, formData): 既存収支を本人検証のうえ反映
export async function reflectTransaction(prev, formData): Promise<ReflectState>;
```

## 未解決の課題

- 一回限りのコピーのため、反映元の編集・削除は反映先に伝播しない（リンク同期は将来課題）。
- 後追い反映を繰り返すと同一収支が重複コピーされうる（リンク管理しないため抑止しない）。
- 反映先で未分類になったカテゴリの後追い整理 UI は未提供。
