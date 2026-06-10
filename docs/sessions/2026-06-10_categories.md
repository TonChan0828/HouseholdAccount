# 2026-06-10 — カテゴリ管理（04_categories）

## やったこと

- PR #3（ダッシュボード＋月次分析、develop→main）を作成（gh CLI を導入・認証して作成）
- カテゴリ管理（04）をブレインストーミングで設計確定 → 仕様書 `docs/specs/04_categories.md` を作成
- カテゴリ管理を TDD 実装:
  - `lib/validations/category.ts` — `categorySchema` / `CATEGORY_COLORS`（12色プリセット、ユニット8件）
  - `components/features/categories/category-form.tsx` — 名前・色・種別フォーム（追加/編集共用）
  - `components/features/categories/delete-category-button.tsx` — confirm 付き削除（Component 計4件）
  - `app/(dashboard)/categories/` — 一覧（type別グループ表示）・new・[id]/edit・Server Actions
  - ダッシュボードに「カテゴリ」導線を追加
- E2E `e2e/categories.spec.ts` を明示実行（追加→一覧→収支フォーム反映→編集→削除）

## 決めたこと・理由

- **デフォルト12件は保護**: UI で操作ボタンを出さず、Server Action でも `is_default = false` 条件（二重防御）。RLS は変更しない
- フォームは **名前＋色（パレット12色）＋種別** のみ。icon 列は UI 未対応のまま（YAGNI）
- **使用中カテゴリの削除は confirm 付きで許可**。取引は `on delete set null` で未分類化
- ページ構成・Server Actions は収支記録（02）と同じ作法（`/categories`・`/categories/new`・`/categories/[id]/edit`）
- 管理権限はメンバー全員（owner 限定にしない。既存 RLS と整合）

## 検証

- Unit/Component 71 件 / typecheck / lint すべて green
- E2E 全10件 green（カテゴリ2件含む、明示実行）

## 次にやること

- メンバー別アクティビティ（07）— auth.users 連携でメンバー表示名を解決し、ダッシュボード・分析のメンバー別フィルタの前提を作る

## 未解決の課題

- アイコン選択（icon 列は保持、UI 未対応）
- カテゴリの並び替え（名前昇順固定）
- owner 限定の管理権限
