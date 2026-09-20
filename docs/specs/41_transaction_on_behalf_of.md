# 収支の代理入力（名義人） 仕様書

## 概要

従来、収支は `transactions.created_by`（＝入力操作をした人）だけが「誰の収支か」を表していた。
そのため、家計簿を実質ひとりが入力している世帯では、配偶者の支出を記帳してもすべて入力者の
記録として集計され、メンバー別アクティビティ（spec 07）・メンバーフィルタ（spec 36）・
精算の支払者（spec 37）・CSV の「登録者」列（spec 17）が実態とズレていた。

本機能では `transactions` に **名義人（`on_behalf_of`）** を1列追加し、
**集計上の帰属ユーザー = `coalesce(on_behalf_of, created_by)`** という単一の概念に集約する。

- `created_by` … 実際に入力操作をした人（不変）
- `on_behalf_of` … 名義人。`NULL` なら入力者本人が名義人

既存行はすべて `on_behalf_of = NULL` のため、**従来の挙動と完全に同一**（後方互換）。

前提として「実際に支払った／受け取ったのは名義人であり、入力を代わっただけ」という意味づけを
採る。立て替えを記録したい場合は名義人を自分のままにする。

## 対象ユーザー・前提条件

- 家計簿グループに所属する認証済みユーザー
- 名義人に選べるのは、**その収支が属するグループの現メンバーのみ**
- 権限の制約は設けない（オーナー限定にはしない）。グループの全メンバーが、任意のメンバーを
  名義人にできる
- 編集・削除できるのは **入力者（`created_by`）と名義人（`on_behalf_of`）の両方**
- 適用範囲は通常の収支の登録・編集のみ。**定期収支（spec 26）・Excel インポート（spec 21）・
  デモモード（spec 20）は対象外**

## 画面・UI

### 表示内容

| 画面 | 従来 | 変更後 |
| --- | --- | --- |
| 収支の追加・編集フォーム（`/transactions/new`・`/transactions/[id]/edit`・モーダル） | 種別／金額／日付／カテゴリ／メモ／精算対象／他グループ反映 | **「名義人」セレクトを追加**（メンバーが2人以上のグループのみ表示） |
| 収支一覧（`/transactions`） | 他人の行に「他のメンバー」バッジ、自分の行だけ編集・削除 | 代理行に **「花子（太郎が代理）」** バッジ。編集・削除は入力者＋名義人に表示 |
| カレンダー（`/calendar`） | 自分の明細のみ編集可 | 代理バッジを表示。編集は入力者＋名義人 |
| ダッシュボードの最近の取引 | 自分の行のみ編集ボタン | 編集ボタンの条件のみ変更（幅が狭いため代理バッジは出さない） |
| 収支一覧のフィルタ（spec 36） | ラベル「メンバー」＝ `created_by` で絞り込み | ラベル「メンバー（名義人）」＝ **帰属ユーザー**で絞り込み |
| メンバー別アクティビティ（spec 07） | `created_by` で集計 | **帰属ユーザー**で集計 |
| 精算（spec 37） | `created_by` を支払者とする | **名義人**を支払者とする |
| CSV エクスポート（spec 17） | 「登録者」＝ `created_by` の表示名 | 「登録者」＝ **帰属ユーザー**の表示名 |

名義人セレクトは `<label>名義人</label>` + `<select name="on_behalf_of">`。自分は
`「〇〇（自分）」` と表示し、既定で選択される。補助文で
「この収支を誰の記録として集計するかを選べます。自分以外を選ぶと代理入力になります。」と示す。

代理バッジには `data-testid="proxy-badge"` を付ける。

### インタラクション・バリデーション

- メンバーが1人だけのグループでは名義人セレクトを**描画しない**（選ぶ意味がないため）
- 名義人に自分を選んだ場合・未指定の場合は `on_behalf_of = NULL` に正規化する
- グループの非メンバーを指定した場合は「名義人はグループのメンバーから選んでください」を返し、
  登録・更新しない（クライアント値を信用せずサーバで所属を再検証する）
- 「登録して続ける」での成功時、金額・メモ・カテゴリはクリアするが **名義人は維持**する
  （他人の分をまとめて入力するのが主用途のため）
- 編集時は現在の名義人が選択された状態で開く。名義人の付け替え・解除ができる
- バリデーション規則は `lib/validations/transaction.ts` の `transactionSchema` に
  `on_behalf_of`（uuid・任意）を追加したもの。`recurringTransactionSchema` は
  `omit({ date: true, on_behalf_of: true })` で**この項目を継承しない**

## データモデル

### 入力

```typescript
// lib/validations/transaction.ts
on_behalf_of: z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.string().uuid("名義人が不正です").optional(),
)
```

```typescript
// components/features/transactions/transaction-form.tsx
type Props = {
  // ...既存
  /** グループの全メンバー。2人以上のときだけ名義人セレクトを出す */
  members?: MemberInfo[];
  /** ログイン中ユーザー（名義人セレクトの既定値） */
  currentUserId?: string;
  defaultValues?: {
    // ...既存
    on_behalf_of?: string | null;
  };
};
```

### 出力

```typescript
// lib/transactions/attribution.ts（純関数・DB も React も触らない）
export type Attributable = { created_by: string; on_behalf_of?: string | null };

export function attributedTo(tx: Attributable): string;          // coalesce(on_behalf_of, created_by)
export function isProxyEntry(tx: Attributable): boolean;         // 名義人 ≠ 入力者
export function canEditTransaction(tx: Attributable, userId: string): boolean;
export function proxyLabel(tx: Attributable, nameById: ReadonlyMap<string, string>): string | null;
export function normalizeOnBehalfOf(value: string | undefined, selfId: string): string | null;
export function attributionOrFilter(userId: string): string;     // PostgREST の or 句
```

`on_behalf_of` を optional にすることで、この列を持たないデモモードの行型もそのまま渡せる。

## Supabase

### 使用テーブル

```sql
transactions(
  id, household_id, created_by, amount, type, category_id, date, memo, created_at,
  is_shared,          -- 37 で追加
  recurring_id,       -- 26 で追加
  on_behalf_of        -- 41 で追加（uuid null。NULL なら入力者本人が名義人）
)
```

名義人がそのグループのメンバーであることは、`household_members (household_id, user_id)` の
一意制約（0001）を参照する**複合外部キー**で DB 側から強制する。`MATCH SIMPLE` の既定により
`on_behalf_of IS NULL` の行は検査対象外になる。`on delete set null (on_behalf_of)` により、
名義人が脱退・除外・退会した時点で `on_behalf_of` が NULL に戻り、帰属が入力者へ自動的に
フォールバックする（収支データ自体は消えない）。

### RLS ポリシー

- `transactions` select: `private.is_household_member(household_id)`（変更なし）
- `transactions` insert: `private.is_household_member(household_id) and created_by = (select auth.uid())`
  （**変更なし**。「入力者は必ず自分」は不変条件として維持し、名義人の妥当性は複合 FK が担保する）
- `transactions` update/delete: **`(created_by = auth.uid() or on_behalf_of = auth.uid())`
  かつ現在もそのグループのメンバーであること**（0024 で緩和）
- UPDATE 条件を OR に緩めたことで `created_by` を他人に書き換える経路が生まれるため、
  `private.freeze_transaction_identity()` の BEFORE UPDATE トリガーで
  `created_by` と `household_id` を不変にする（**省略するとなりすましが可能になる**）
- `recurring_transactions` のポリシーは変更しない

マイグレーション: `supabase/migrations/0024_transaction_on_behalf_of.sql`

### クエリ / Server Action

```typescript
// app/(dashboard)/transactions/actions.ts
createTransaction(formData)   // on_behalf_of を正規化・所属検証して insert
updateTransaction(formData)   // 名義人の付け替え・解除を許可
deleteTransaction(formData)   // コード変更なし（RLS + household_id スコープ）
reflectTransaction(formData)  // 所有チェックを canEditTransaction に変更
```

名義人の所属検証には `getHouseholdMemberNames(householdId)`（spec 35 の単一実装点・
`cache()` 済み）を使い、生の FK 違反ではなく日本語エラーを返す（`mirrorTransaction` が
`getUserHouseholds()` で反映先を検証しているのと同じ多層防御の作法）。

DB 側で帰属ユーザーを絞り込むのは `lib/queries/transactions.ts#buildTransactionQuery`
の1箇所だけで、PostgREST の or 句で表現する。

```text
or=(on_behalf_of.eq.<uuid>,and(on_behalf_of.is.null,created_by.eq.<uuid>))
```

トップレベルの `or` は他の条件と AND で結合されるため既存フィルタと共存する。フィルタ文字列の
インジェクションを防ぐため、`attributionOrFilter` 内で UUID を再検証して不正なら例外を投げる。

## テスト

- Unit: `lib/transactions/attribution.test.ts`（帰属・代理判定・編集可否・or 句生成）、
  `lib/members.test.ts` / `lib/settlement.test.ts` / `lib/category-matrix.test.ts`（名義人基準の集計）、
  `lib/validations/transaction.test.ts`、`lib/queries/transactions.test.ts`（or 句が渡ること）
- Component: `transaction-form.test.tsx`（1人なら非表示・既定値・FormData・続けて登録で維持）、
  `transaction-dialog.test.tsx`、`calendar-board.test.tsx`
- Server Action: `app/(dashboard)/transactions/actions.test.ts`
- E2E: `e2e/transactions-proxy.spec.ts`（招待で2人目を参加させ、代理入力→名義人基準の集計→
  名義人による編集・削除まで）、`e2e/transactions-filter.spec.ts`（or 句の実機検証）

## 未解決の課題

- **精算スナップショットとの不整合**: 精算済み期間（spec 37）の収支に後から名義人を付けると、
  保存済みスナップショットと再計算結果がズレて画面に差異警告が出る。これは収支を編集したときと
  同じ仕様どおりの挙動とし、過去のスナップショットは書き換えない
- **Excel インポート（spec 21）への拡張**: 現状は常に `on_behalf_of = NULL`。「この取り込み分の
  名義人」を選べるようにする案はあるが、今回は適用範囲外とした
- **定期収支（spec 26）への拡張**: 同様に対象外。Cron の service-role RPC まで波及するため、
  必要になった時点で別仕様として設計する
- **グループ間反映（spec 28）では名義人を引き継がない**: 反映先グループに同じユーザーが
  所属しているとは限らず、引き継ぐと複合 FK 違反で反映全体が失敗するため。コピー行は反映操作者の
  記録になる
- **生成列への移行余地**: 帰属ユーザーを DB で絞る箇所が現状1つしかないため or 句で済ませている。
  `.or()` の使用箇所が3つを超えたら、`attributed_to generated always as (coalesce(...)) stored`
  の生成列＋単一インデックスへ移行する
