# アーキテクチャリファクタリング（データアクセス集約） 仕様書

## 概要

機能追加を重ねた結果、ページ・Server Action に散在した定型処理を共通ヘルパーへ集約する。
挙動を変えないリファクタリング（段階1〜3）と、定期収支の閲覧時生成の呼び出し漏れ修正（段階4）で構成する。

対象の重複:

1. 認証ガード定型文（`getUser → redirect("/login") → getActiveHouseholdId → redirect("/households")`）が約32箇所
2. メンバー名解決（`household_members` + `profiles` + `display_name` フォールバック）が6箇所
3. `transactions` の期間スコープ取得（select 文字列の重複）が8箇所
4. `ensureRecurringGenerated` が dashboard / transactions / calendar のみで呼ばれ、analytics / budgets / members で未呼び出し（月初に未生成の定期収支が集計から漏れる）

## 対象ユーザー・前提条件

- 利用者に見える挙動は段階4を除き変更しない（段階4は「正しい集計になる」方向の修正）
- 既存のセキュリティ方針を維持する: RLS + アプリ層の `household_id` スコープ（多層防御）、Cookie は検証してから信頼

## 画面・UI

UI 変更なし。段階4のみ、月初などに analytics / budgets / members を最初に開いた場合でも当期の定期収支が集計に含まれるようになる。

## データモデル

### 段階1: `requireDashboardContext()`（`lib/household.ts`）

```typescript
type DashboardContext = {
  user: User;               // 認証済みユーザー（未認証は redirect("/login")）
  householdId: string;      // アクティブグループ（未所属は redirect("/households")）
  supabase: ServerClient;   // Server 用 Supabase クライアント
};

// React cache() 済みの getCurrentUser / getActiveHouseholdId を内部で使うため
// 同一リクエスト内で何度呼んでも DB 往復は増えない。
function requireDashboardContext(): Promise<DashboardContext>;
```

- 適用対象: `(dashboard)` 配下の全 page / Server Action（15ページ + 6 action ファイル）、`app/(dashboard)/layout.tsx`
- 適用除外: 認証不要ルート（`(auth)`・`demo`・`invite`・LP）、`app/households`（未所属でも開ける・user のみ必須）、`settings/*`（アカウント設定はグループ不要）、`transactions/export/route.ts`（Route Handler はリダイレクトでなく 401/403 を返す仕様のため）

### 段階2: `getHouseholdMemberNames()`（`lib/queries/members.ts`）

```typescript
// 戻り値は既存の MemberInfo（lib/members.ts）を再利用する
type MemberInfo = { user_id: string; display_name: string };

// household_members.display_name ?? profiles.display_name ?? "不明なユーザー"
// の優先順で解決する（spec 22 のフォールバック仕様の単一実装点にする）。
// cache() でリクエスト内の重複呼び出しを集約する。
function getHouseholdMemberNames(householdId: string): Promise<MemberInfo[]>;
```

- 置換対象: `dashboard/page.tsx`・`members/page.tsx`・`transactions/recurring/page.tsx`
- 対象外（意図的な仕様差のため現状維持）: `transactions/export/route.ts` は CSV 用にフォールバック末尾が `null`、`households/page.tsx` は複数グループ横断で role 付きの別形状

### 段階3: `fetchTransactionsInRange()`（`lib/queries/transactions.ts`）

```typescript
type TransactionRow = {
  id: string;
  amount: number;
  type: "income" | "expense";
  date: string;
  memo: string | null;
  created_by: string;
  category_id: string | null;
  recurring_id: string | null;
  category: { name: string; color: string | null } | null;
};

// household_id + [start, end) でスコープし、date desc / created_at desc で返す。
function fetchTransactionsInRange(
  supabase: ServerClient,
  householdId: string,
  range: { start: Date; end: Date },
): Promise<TransactionRow[]>;
```

- select カラムは最大集合（`TransactionRow`）に統一し、呼び出し側は必要なフィールドだけ使う
- 置換対象: dashboard / transactions / calendar / members / analytics / budgets の各 page（export・recurring は select 内容が異なるため対象外とし、無理に統一しない）

### 段階4: `ensureRecurringGenerated` の追加呼び出し

- `analytics/page.tsx`・`budgets/page.tsx`・`members/page.tsx` の当期データ取得前に呼ぶ
- `lib/recurring.ts` の実装は `cache()` 済み・冪等のため多重呼び出しの副作用はない

## Supabase

### 使用テーブル

- 既存テーブルのみ（`households` / `household_members` / `profiles` / `transactions` / `categories` / `budgets` / `savings_goals` / `recurring_transactions`）。スキーマ変更・マイグレーションなし

### RLS ポリシー

- 変更なし。アプリ層の `household_id` スコープは新ヘルパー内で必ず付与し、多層防御を維持する

### クエリ / Server Action

- Server Action のシグネチャ・戻り値（`TransactionActionState` など）は変更しない
- リダイレクト挙動（未認証 → `/login`、未所属 → `/households`）は現行と同一にする

## テスト方針

- 段階1・2・3: ヘルパーのユニットテストを先に書く（TDD）。Supabase クライアントはモック
- 既存のユニット・コンポーネントテストが全て通ることを各段階の完了条件とする
- 段階4: Server Component を関数として直接呼び、`ensureRecurringGenerated` が householdId 付きで呼ばれることをページ単位のユニットテストで検証する（`analytics/budgets/members` の `page.test.tsx`）。期跨ぎの実データは E2E で期間境界を再現できないためユニットで代替（対応表 #35 に根拠を記載）
- 各段階のコミット前に `npm run test:e2e`（`--workers=1`、CI 同条件）全通過を確認する

## コミット計画

| 段階 | type | 内容 |
| --- | --- | --- |
| 1 | `refactor` | 認証ガードを requireDashboardContext に集約 |
| 2 | `refactor` | メンバー名解決を getHouseholdMemberNames に集約 |
| 3 | `refactor` | 期間スコープの収支取得を fetchTransactionsInRange に集約 |
| 4 | `fix` | analytics・budgets・members で定期収支の閲覧時生成が呼ばれない問題を修正 |

## 未解決の課題

- `types/database.ts` を `supabase gen types typescript` の自動生成に切り替えるか（本リファクタの対象外・別途検討）
- デモモード（`app/demo/`）の並行実装の共通化（spec 20 の意図通り現状維持）
