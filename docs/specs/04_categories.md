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

- type ごと（支出 → 収入 → 両方）にグループ表示。各グループ内は保存済みの手動順
- 各行: 色に加え、アイコンが設定されていればアイコン＋カテゴリ名。未設定は従来の色ドットを表示する。デフォルトは「デフォルト」バッジを表示する
- カスタムのみ [編集]（`/categories/[id]/edit`）と [削除] を表示
- 各行にアクセス可能な「上へ移動」「下へ移動」ボタンを表示する。先頭/末尾では移動できない方向のボタンを disabled にする。順序は household 内で共有する
- 追加は `/categories/new`、編集は `/categories/[id]/edit`（transactions と同じページ構成）

### フォーム項目（追加・編集共通）

- **名前**: 必須、1〜50字（DB の check 制約と同じ）
- **色**: プリセットパレット12色から選択（デフォルトカテゴリと同系の Tailwind 系統色）
- **アイコン**: 用意した12種類から選択、または「なし」。未選択時は `icon = null` とし、未知の値は保存しない
- **種別**: 支出 / 収入 / 両方（`category_type`）

### インタラクション・バリデーション

- 名前が空・50字超ならエラーメッセージを表示して送信しない
- 同じグループ・種別内では、前後空白と大文字小文字を無視した同名カテゴリを登録できない（DBでも検証）
- 削除はカスタムのみ。確認ダイアログ「カテゴリを削除しますか？」（説明: このカテゴリを使用している収支は「未選択」に変更されます。）で「削除する」を押すと実行し、「キャンセル」では何もしない
- 削除の成否は Server Action が実際に削除した行（`.select("id")`）で判定する。PostgREST の DELETE は 0 件でもエラーを返さないため、0 件（既に削除済み・デフォルト・他グループ）は失敗として扱う
  - 成功: 全画面を再検証して `/categories?deleted=1` へ遷移し、「カテゴリを削除しました。」を `role="status"` で表示する
  - 0 件: 「このカテゴリは削除できませんでした（既に削除済み、またはデフォルトカテゴリです）。一覧を再読み込みしてください。」をダイアログ内に `role="alert"` で表示する
  - DB エラー・通信失敗: 「カテゴリの削除に失敗しました。時間をおいて再度お試しください。」をダイアログ内に表示する。いずれも成功に見せない
- 削除後の取引は DB の `on delete set null` により「未分類」になる（取引自体は残る）
- デフォルトカテゴリへの update/delete は Server Action 側でも拒否する（二重防御）
- 重複名のDBエラー（SQLSTATE `23505`）は、追加・編集画面で利用者向けメッセージに変換する

## データモデル

```typescript
// types/index.ts（既存）
type Category = Tables["categories"]["Row"];
// { id, household_id, name, color, icon, type: "income" | "expense" | "both", is_default, sort_order }

// フォーム入力
type CategoryInput = {
  name: string;       // 1〜50字
  color: string;      // プリセットパレット内の HEX
  icon: string | null; // 許可済みのアイコン識別子。未選択は null
  type: "income" | "expense" | "both";
};
```

`icon` 列は今回使用しない（フォームに含めず null のまま）。

## Supabase

### 使用テーブル

- `categories`（`sort_order` を追加。household・type 内の順序を保存）

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
  .order("type", { ascending: true })
  .order("sort_order", { ascending: true })
  .order("name", { ascending: true });
// type ごとのグループ化は JS で行う

// app/(dashboard)/categories/actions.ts
createCategory(formData); // name/color/type を検証して insert（is_default: false）
updateCategory(formData); // id + household_id + is_default=false でスコープして update
deleteCategory(formData); // id + household_id + is_default=false でスコープして delete
```

- 既存カテゴリは移行時に type ごとの名前昇順で `sort_order` を初期化する。新規カテゴリと種別変更は移動先 type の末尾に追加する
- 並び替え Action は household と type を検証した上で対象 type の ID 全件を DB RPC に渡す。RPC は household メンバー権限・ID重複なし・現在の全件一致を確認し、advisory lock 下で原子的に更新する。古い一覧からの操作は拒否して最新順を再表示する
- 収支・定期収支・予算などのカテゴリ候補も `type` → `sort_order` の順で取得し、管理画面と同じ type 内の順序を使う

- update/delete は `.eq("household_id", activeId).eq("is_default", false)` を必ず付ける
- バリデーション: name 必須・1〜50字、type は enum 3値、color はパレット内、icon は許可リスト内または null のみ許可

## コンポーネント

- `components/features/categories/category-form.tsx` — 名前・色・種別のフォーム（presentational、`TransactionForm` と同型。追加/編集で共用）
- `components/features/categories/delete-category-button.tsx` — `"use client"`、確認ダイアログ付き削除ボタン（`useActionState`。失敗はダイアログ内に表示）
- `/categories` — 種別内の並び替えフォームを表示。DB RPC が対象 ID 全件を検証して保存する
- 一覧はページ内でレンダリング
- 収支・定期収支・予算のカテゴリ候補も保存済み順を使う。金額などの分析ランキングは変更しない

## テスト

- Unit: 入力バリデーション（name 空・51字・type 不正・color パレット外）
- Component: `CategoryForm`（入力と初期値の表示）、`CategoryBadge`（設定アイコンの表示）、`DeleteCategoryButton`（キャンセル時に送信しない・id を送信・エラー state と例外をダイアログ内に表示）
- Unit: `deleteCategory`（id・household_id・is_default でスコープ、削除行 0 件と DB エラーを失敗として返す、成功時の再検証と遷移）
- E2E（`e2e/categories.spec.ts`）: グループ作成 → アイコン付きカテゴリ追加 → 一覧表示 → 収支フォームの選択肢に反映 → アイコン変更を含む編集 → 削除（ダイアログで「削除する」）→ 成功表示 → 再読み込み後も消えたまま。デフォルトカテゴリに操作ボタンが無いことも確認。別シナリオで、収支に使われているカテゴリのキャンセル→削除→再読み込み・画面遷移後も復活しない→収支は「未分類」（編集フォームは「未選択」）→収支登録フォームとカテゴリ絞り込みの選択肢に出ないことを確認
- E2E（`e2e/categories-order.spec.ts`）: type 内の上下移動、再読み込み後の永続化、収支・定期収支のカテゴリ候補への反映を確認
- Database（`supabase/tests/database/category_sort_order.sql`）: RPC権限、member/household境界、全件順序の置換、部分・重複・別household IDの拒否、新規作成・種別変更時の末尾追加を確認

## 未解決の課題

- 既存データのうち、予算が複数ある重複カテゴリや名前表記・色・icon・default・通知設定が異なる重複は自動統合せず残す（要確認）

既存データの重複のうち、同一 household・同一種別で名前と表示属性が完全一致し、予算が合計1件以下のものは、migration `0029` で取引・定期取引・予算の参照を維持して統合する。それ以外はデータを変更しない。

## カテゴリの統合とプリセットの非表示

オーナーはカスタムカテゴリの削除時に、対応する種別の移行先を選べます。収支、定期収支、予算の件数を表示して確認します。移行先にも予算がある場合は統合できません。参照の移行と元カテゴリの削除は一括で行います。

グループのメンバーはプリセットを非表示にできます。管理画面の「非表示のカテゴリ」から再表示できます。非表示中は新規入力と絞り込みの候補から外れます。既存明細とその編集、分析、CSV ではカテゴリを保持します。表示中のカテゴリを並べ替えても、非表示カテゴリの位置は維持します。
