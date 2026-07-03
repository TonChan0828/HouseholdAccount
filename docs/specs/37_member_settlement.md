# メンバー間精算（割り勘） 仕様書

## 概要

誰かが立て替えた「精算対象」の支出を、当期（締め日ベース）ごとに全メンバーで均等割りし、
各メンバーの立替額・過不足と「誰が誰にいくら払えば清算されるか」の送金案を表示する機能（`/settlements`）。
内容を確認したら「精算済みにする」でその期間の精算を確定し、スナップショットとして記録する。

複数アカウントで家計簿を共有する本アプリのコンセプトに直結する機能で、既存の
`transactions.created_by`（登録者 = 立て替えた人）を按分の基礎データとして再利用する。

## 対象ユーザー・前提条件

- ログイン済みかつ `active_household_id` が選択済みのユーザー（未選択時は `/households` へリダイレクト）
- 同じ household に所属するメンバーのデータのみ表示・操作する（household スコープ規約に準拠）
- 按分は**現メンバー全員の均等割り**のみ（比率設定は将来拡張）

## 画面・UI

### 表示内容

`/settlements`（ナビに「精算」を追加。既存 `MonthNav` で期間移動、`?ref=` パラメータ・`period_start_day` 対応）:

- 当期サマリー: 精算対象支出の合計・メンバー数・1人あたり負担額
- メンバー別カード: 表示名（`getHouseholdMemberNames` で解決）・立替額・差額（正 = 受け取る / 負 = 支払う）
- 送金案リスト: 「A さん → B さん ¥X」の形式で最大 N−1 件
- 未精算の期間: 「精算済みにする」ボタン
- 精算済みの期間: 「精算済み」バッジ・精算日時・実行者名・スナップショットの内容（立替額・送金案）・取り消しボタン（実行者本人のみ表示）
- 精算後に対象取引が追加・編集・削除され、スナップショットと現在の再計算結果がずれた場合は「現在の記帳内容と差異があります」と警告を表示する（差異判定は `SettlementResult` の比較。表示名の変更は差異とみなさない）
- 対象支出が 0 件の期間は「この期間に精算対象の支出はありません」を表示
- メンバーが 1 人の場合は「精算の必要はありません」を表示

記帳フォーム（`transaction-form.tsx`・新規/編集共通）:

- 種別が「支出」のときのみ「精算対象（割り勘）」チェックボックスを表示する（既定 OFF）
- 種別を「収入」に切り替えたらチェックは無効（送信値も false）

定期収支フォーム（`recurring-form.tsx`）:

- 支出のとき同じチェックボックスを表示し、自動生成される取引に `is_shared` を引き継ぐ

収支一覧（`/transactions`）:

- 精算対象の行に小さな「精算」バッジを表示する

### インタラクション・バリデーション

- 「精算済みにする」は確認モーダルを挟み、実行時点の計算結果をスナップショットとして保存する
- 同一期間の二重精算は DB の unique 制約で防止し、競合時は「すでに精算済みです」を表示して再描画する
- 取り消しは実行者本人のみ（RLS で強制）。取り消すと未精算状態に戻る
- `is_shared` はチェックボックス由来のため boolean 正規化（`"on"`/`"true"`/未指定→false）を経て検証する
- 精算の「実行」はメンバーなら誰でも可能（owner 限定にしない）

## データモデル

### 入力

```typescript
// URL パラメータ
type SearchParams = { ref?: string }; // 期間基準日（YYYY-MM-DD）。不正・未指定は今日

// 記帳フォームへの追加フィールド（lib/validations/transaction.ts）
// transactionSchema / recurringTransactionSchema に is_shared を追加
type TransactionInput = {
  /* 既存フィールド */
  is_shared: boolean; // チェックボックス由来。z.preprocess で boolean に正規化、既定 false
};

// 計算関数の入力（lib/settlement.ts）
type SettlementTx = {
  amount: number;
  type: "income" | "expense";
  created_by: string;
  is_shared: boolean;
};
// メンバーは lib/queries/members.ts#getHouseholdMemberNames の MemberInfo[]（joined_at 昇順）
```

### 出力

```typescript
// lib/settlement.ts: buildSettlement(txs, members)
type SettlementMemberRow = {
  userId: string;
  displayName: string;
  paid: number;    // 当期の精算対象支出の立替合計
  balance: number; // paid − 1人あたり負担額（整数円・全員の合計は必ず 0）
};

type SettlementTransfer = {
  fromUserId: string;
  toUserId: string;
  amount: number; // 整数円・1 以上
};

type SettlementResult = {
  total: number;              // 精算対象支出の合計
  perMember: number;          // 1人あたり負担額（表示用・四捨五入）
  rows: SettlementMemberRow[];
  transfers: SettlementTransfer[]; // 最大 members.length − 1 件
};

// settlements.snapshot（jsonb）には SettlementResult に加えて
// 各行・送金の displayName を精算時点の名前で保存する（後の名前変更に影響されない）
```

計算仕様:

1. 当期の `is_shared = true` かつ `type = "expense"` の取引のみ対象とする
2. `created_by` が現メンバーでない取引（脱退者分）は集計対象外（spec 07 と同じ扱い）
3. `balance = paid − total / N` を実数で求め、**最大剰余法**で整数円に丸めて合計 0 を保証する
4. 送金案は greedy（残高最小の債務者 → 残高最大の債権者へ順に送金）で生成する

## Supabase

### 使用テーブル

- `transactions` — `is_shared boolean not null default false` を追加（migration 0021）。既存行は false
- `recurring_transactions` — `is_shared boolean not null default false` を追加（同 migration）。自動生成時に取引へ引き継ぐ
- `settlements`（新設・同 migration）
  - `id uuid PK default gen_random_uuid()`
  - `household_id uuid not null` — `households(id)` 参照（on delete cascade）
  - `period_start date not null` — 当期の開始日（`period_start_day` から算出）
  - `settled_by uuid not null` — `auth.users(id)` 参照
  - `settled_at timestamptz not null default now()`
  - `snapshot jsonb not null` — 精算時点の `SettlementResult` ＋表示名
  - `unique (household_id, period_start)` — 二重精算防止
- `household_members` / `profiles` — メンバー・表示名解決（既存の `getHouseholdMemberNames` を利用）

### RLS ポリシー

- `settlements`
  - SELECT / INSERT: `household_members` に自分の `user_id` が存在する `household_id` のみ
  - DELETE: 上記に加え `settled_by = auth.uid()` のみ（取り消しは実行者本人）
  - UPDATE: ポリシーなし（更新は行わない）
- `transactions` / `recurring_transactions`: 既存ポリシーのまま（`is_shared` は列追加のみ）

### クエリ / Server Action

```typescript
// app/(dashboard)/settlements/page.tsx（Server Component）
// 1. fetchTransactionsInRange で当期取引を取得（TransactionRow に is_shared を追加）
// 2. getHouseholdMemberNames でメンバー解決
// 3. lib/settlement.ts#buildSettlement で純関数計算
// 4. settlements から当期の精算記録を取得（household_id + period_start）

// Server Actions（app/(dashboard)/settlements/actions.ts）
async function createSettlement(periodRef: string): Promise<ActionResult>;
// - 当期を再計算し snapshot を保存。unique 違反は「すでに精算済みです」を返す
async function deleteSettlement(settlementId: string): Promise<ActionResult>;
// - RLS により実行者本人のみ成功する

// 既存 Server Action の変更
// - transactions の create / update: is_shared を保存
// - recurring の create / update: is_shared を保存し、生成処理（lib/recurring.ts）で取引へ引き継ぐ
// - グループ間反映（lib/transactions/mirror.ts）: 反映先は false 固定
//   （反映先グループはメンバー構成が異なるため精算対象を引き継がない）
```

## 未解決の課題

- メンバー別比率（収入比など）での按分は将来拡張。今回は均等割りのみ
- CSV 出力・Excel インポート・収支一覧の FilterBar への `is_shared` 対応はスコープ外
- 全期間をまたぐ未精算残高の繰り越しは行わない（期間単位で完結）
- 精算済み期間の対象取引の編集をブロックしない（差異警告の表示のみで対応）
