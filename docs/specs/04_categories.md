# カテゴリ管理 仕様書

## 概要

グループ共有カテゴリの閲覧・追加・編集・削除（`/categories`）。
グループ作成時にシードされるデフォルト12件は**保護**（編集・削除不可、一覧には表示）し、
カスタムカテゴリのみ CRUD できる。ページ構成・Server Actions は収支記録（02）と同じ作法に揃える。

## 対象ユーザー・前提条件

- ログイン済みかつアクティブな household を選択しているメンバー
- アクティブ household 未選択なら `/households` へ誘導
- すべて `household_id` でスコープ（`lib/household.ts#getActiveHouseholdId`）
- カスタムカテゴリの管理権限はメンバー全員（owner 限定にしない。既存 RLS と同じ）

## 画面・UI

### レイアウト

```text
カテゴリ                         [カテゴリを追加]

支出
 ● 食費        デフォルト
 ● ペット                   [編集] [削除]

収入
 ● 給与        デフォルト

両方
 ● 立替                     [編集] [削除]
```

### 表示内容

- type ごと（支出 → 収入 → 両方）にグループ表示。各グループ内は名前昇順
- 各行: 色ドット＋カテゴリ名。デフォルトは「デフォルト」バッジを表示し操作ボタンを置かない
- カスタムのみ [編集]（`/categories/[id]/edit`）と [削除] を表示
- 追加は `/categories/new`、編集は `/categories/[id]/edit`（transactions と同じページ構成）

### フォーム項目（追加・編集共通）

- **名前**: 必須、1〜50字（DB の check 制約と同じ）
- **色**: プリセットパレット12色から選択（デフォルトカテゴリと同系の Tailwind 系統色）
- **種別**: 支出 / 収入 / 両方（`category_type`）

### インタラクション・バリデーション

- 名前が空・50字超ならエラーメッセージを表示して送信しない
- 削除はカスタムのみ。`confirm()` で「紐づく取引は未分類になります。削除しますか？」を確認してから実行
- 削除後の取引は DB の `on delete set null` により「未分類」になる（取引自体は残る）
- デフォルトカテゴリへの update/delete は Server Action 側でも拒否する（二重防御）

## データモデル

```typescript
// types/index.ts（既存）
type Category = Tables["categories"]["Row"];
// { id, household_id, name, color, icon, type: "income" | "expense" | "both", is_default }

// フォーム入力
type CategoryInput = {
  name: string;       // 1〜50字
  color: string;      // プリセットパレット内の HEX
  type: "income" | "expense" | "both";
};
```

`icon` 列は今回使用しない（フォームに含めず null のまま）。

## Supabase

### 使用テーブル

- `categories`（既存。スキーマ変更なし）

### RLS ポリシー（既存・変更なし）

- select / insert / update / delete: `is_household_member(household_id)`
- デフォルト保護は RLS ではなく Server Action の `is_default = false` 条件で担保する

### クエリ / Server Action

```typescript
// 一覧（Server Component）
supabase
  .from("categories")
  .select("*")
  .eq("household_id", activeId)
  .order("name", { ascending: true });
// type ごとのグループ化は JS で行う

// app/(dashboard)/categories/actions.ts
createCategory(formData); // name/color/type を検証して insert（is_default: false）
updateCategory(formData); // id + household_id + is_default=false でスコープして update
deleteCategory(formData); // id + household_id + is_default=false でスコープして delete
```

- update/delete は `.eq("household_id", activeId).eq("is_default", false)` を必ず付ける
- バリデーション: name 必須・1〜50字、type は enum 3値、color はパレット内のみ許可

## コンポーネント

- `components/features/categories/category-form.tsx` — 名前・色・種別のフォーム（presentational、`TransactionForm` と同型。追加/編集で共用）
- `components/features/categories/delete-category-button.tsx` — `"use client"`、confirm 付き削除ボタン
- 一覧はページ内でレンダリング
- 既存の `/transactions`・ダッシュボード・分析のコードは変更しない

## テスト

- Unit: 入力バリデーション（name 空・51字・type 不正・color パレット外）
- Component: `CategoryForm`（入力と初期値の表示）、`DeleteCategoryButton`（confirm キャンセル時に送信しない）
- E2E（`e2e/categories.spec.ts`）: グループ作成 → カテゴリ追加 → 一覧表示 → 収支フォームの選択肢に反映 → 編集 → 削除（confirm 承諾）→ 一覧から消える。デフォルトカテゴリに操作ボタンが無いことも確認

## 未解決の課題

- アイコン選択（icon 列は保持するが UI 未対応）
- カテゴリの並び替え（現状は名前昇順固定）
- owner 限定の管理権限（現状はメンバー全員が管理可能）
