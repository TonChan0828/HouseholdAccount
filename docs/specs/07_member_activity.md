# メンバー別アクティビティ 仕様書

## 概要

家計簿グループの各メンバーが当期に登録した収支を、メンバーごとに集計・個別表示する画面（`/members`）。
誰がどれだけ収入・支出を登録したかを一覧で比較でき、カードをクリックするとそのメンバーの取引明細を展開できる。

メンバーの表示名はこれまで取得手段がなかったため、本機能で `profiles` テーブルを新設する。

## 対象ユーザー・前提条件

- ログイン済みかつ `active_household_id` が選択済みのユーザー（未選択時は `/households` へリダイレクト）
- 同じ household に所属するメンバーのデータのみ表示する（household スコープ規約に準拠）

## 画面・UI

### 表示内容

- ページタイトル「メンバー別アクティビティ」＋グループ選択リンク（既存ページと同レイアウト）
- 期間ナビ（既存 `MonthNav`、`?ref=` URL パラメータ。`period_start_day` 対応）
- 全メンバーのサマリーカードをグリッド表示（2列、モバイルは1列）
  - 表示名・当期の収入合計・支出合計・取引件数
  - 取引が0件のメンバーもカード表示（¥0 / 0件）
- 選択中メンバーの取引一覧（日付降順、カテゴリ名・色、メモ、金額）

### インタラクション・バリデーション

- サマリーカードをクリックすると、そのメンバーの当期取引一覧をカード群の下に展開する（クライアント状態、リロードなし）
- 選択中カードを再クリックすると閉じる。別カードをクリックすると切り替わる
- 選択中カードは強調表示（`aria-pressed` 付与）
- 取引が0件のメンバーを展開した場合は「この期間の取引はありません」を表示
- 期間を移動すると選択状態はリセットされる（サーバー再描画のため）

## データモデル

### 入力

```typescript
// URL パラメータ
type SearchParams = { ref?: string }; // 期間基準日（YYYY-MM-DD）。不正・未指定は今日

// 集計関数の入力（lib/members.ts）
type MemberTx = {
  amount: number;
  type: "income" | "expense";
  date: string;
  memo: string | null;
  created_by: string;
  category: { name: string; color: string } | null;
};

type MemberInfo = {
  user_id: string;
  display_name: string;
};
```

### 出力

```typescript
// メンバーごとの当期集計（lib/members.ts: summarizeByMember）
type MemberSummary = {
  userId: string;
  displayName: string;
  income: number; // 当期収入合計
  expense: number; // 当期支出合計
  count: number; // 当期取引件数
};
// 並び順は household_members.joined_at 昇順を維持する
```

## Supabase

### 使用テーブル

- `profiles`（新設・migration `0009_profiles.sql`）
  - `id uuid PK` — `auth.users(id)` 参照（on delete cascade）
  - `display_name text not null` — 初期値はメールの `@` より前
  - `created_at timestamptz not null default now()`
  - `auth.users` への INSERT トリガー（SECURITY DEFINER）で自動登録し、既存ユーザーはマイグレーション内でバックフィルする
  - 表示名の編集 UI は今回のスコープ外（将来の設定画面で対応）
- `household_members` — メンバー一覧の取得
- `transactions` — 当期の取引取得（`category:categories(name, color)` join）

### RLS ポリシー

- `profiles`
  - SELECT: 自分自身（`id = auth.uid()`）、または同じ household に所属しているメンバーのプロフィールのみ
  - INSERT / UPDATE / DELETE: ポリシーなし（登録はトリガー経由のみ）
- `transactions` / `household_members`: 既存ポリシーのまま（所属 household のデータのみ）

### クエリ / Server Action

```typescript
// app/(dashboard)/members/page.tsx（Server Component、Server Action なし）

// 1. メンバー取得（joined_at 昇順）
supabase
  .from("household_members")
  .select("user_id, joined_at")
  .eq("household_id", householdId)
  .order("joined_at");

// 2. プロフィール取得
supabase.from("profiles").select("id, display_name").in("id", userIds);

// 3. 当期取引取得（household スコープ）
supabase
  .from("transactions")
  .select("amount, type, date, memo, created_by, category:categories(name, color)")
  .eq("household_id", householdId)
  .gte("date", isoStart)
  .lt("date", isoEnd)
  .order("date", { ascending: false });

// 集計はサーバー側で lib/members.ts の純粋関数 summarizeByMember() が行い、
// サマリーと取引リストを client component（MemberActivity）に渡す
```

## 未解決の課題

- 表示名の編集機能（profiles の UPDATE ポリシー含む）は将来の設定画面で対応する
- メンバーが脱退した場合、過去取引の `created_by` が member 一覧に存在しない可能性がある（今回は所属メンバーのみ表示し、脱退者の取引はカードに紐付かない）
