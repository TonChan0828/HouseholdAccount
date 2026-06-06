# 家計簿グループ管理 仕様書

## 概要

家計簿グループ（household）と、そのメンバー（household_members）を管理する。
本フェーズ（基盤構築）では DB スキーマ・RLS・初期化トリガを確定する。
グループ作成・招待・切り替えの UI は次フェーズで実装する。

## 対象ユーザー・前提条件

- ログインユーザーはグループを作成できる（作成者は自動的に `owner` になる）
- メンバー招待・グループ削除は `owner` のみ
- メンバーは自分の脱退（自分の行の削除）が可能

## 画面・UI

### 表示内容

- `/households`: グループ選択・作成（本フェーズはログイン確認用プレースホルダ）

### インタラクション・バリデーション

- グループ名: 1〜100文字
- （次フェーズ）メール招待、アクティブグループの切り替え（Cookie 保存）

## データモデル

### 入力

```typescript
// types/database.ts の Insert 型
households.Insert         // { name, created_by }
household_members.Insert  // { household_id, user_id, role? }
```

### 出力

```typescript
// types/index.ts
type Household = { id; name; created_by; created_at };
type HouseholdMember = { id; household_id; user_id; role; joined_at };
type Member = HouseholdMember & { email?; display_name? };
```

## Supabase

### 使用テーブル

```sql
households(id, name, created_by, created_at)
household_members(id, household_id, user_id, role['owner'|'member'], joined_at, unique(household_id,user_id))
categories(id, household_id, name, color, icon, type['income'|'expense'|'both'], is_default)
transactions(id, household_id, created_by, amount:int, type['income'|'expense'], category_id, date, memo, created_at)
```

金額（`amount`）は円建てのため `integer`（小数なし）。

### RLS ポリシー

判定は SECURITY DEFINER 関数で行い、`household_members` の自己参照による無限再帰を回避する。

- `is_household_member(_household_id)` / `is_household_owner(_household_id)`
- 全テーブル select: `is_household_member(household_id)`
- `households`: insert は `created_by = auth.uid()`、update/delete は owner
- `household_members`: insert は owner（招待）、delete は owner または本人（脱退）
- `categories`: 全操作メンバー可
- `transactions`: insert はメンバー かつ `created_by = auth.uid()`、update/delete は `created_by = auth.uid()` のみ

### 初期化トリガ

```sql
-- 0003_household_bootstrap.sql
on_household_created (after insert on households):
  1. 作成者を owner として household_members に登録（RLS ブートストラップ回避）
  2. デフォルトカテゴリ（支出9 + 収入3）を付与
```

### クエリ / Server Action

```typescript
// lib/household.ts
getActiveHouseholdId(): Cookie 優先、無ければ所属する最古のグループにフォールバック
```

## 未解決の課題

- グループ作成・招待・切り替えの Server Action と UI（次フェーズ）
- メンバー一覧でのメール/表示名取得（auth.users との結合方法。Edge Function か admin API 検討）
- アクティブグループ切り替え時の Cookie 設定 Server Action
