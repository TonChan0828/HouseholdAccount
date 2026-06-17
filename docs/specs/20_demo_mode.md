# 20. デモモード（ログイン不要のお試しページ）

## 機能概要・目的

未ログインの訪問者が、新規登録せずに家計簿アプリの主要機能（収支記録・カテゴリ管理・ダッシュボード）を操作して体験できる「デモモード」を提供する。ポートフォリオとして、登録の壁の前に価値を体感してもらうことが目的。

**データ永続化の方針**:

- サーバ／DB（Supabase）には一切書き込まない。
- 状態はブラウザのメモリ（React Context）のみで保持する。
- **ページを更新（リロード）すると初期サンプル状態に戻る**。localStorage 等の永続化も行わない。

## 対象範囲

| 画面 | 操作 |
| --- | --- |
| ダッシュボード | 当期サマリー・収支グラフ・カテゴリ×メンバーマトリクス・最近の取引（閲覧、全体/自分の切替） |
| 収支 | 一覧・追加・編集・削除（期間切替） |
| カテゴリ | 一覧・追加・編集・削除（デフォルトカテゴリは編集/削除不可） |

分析（`/analytics`）・メンバー別アクティビティ（`/members`）・グループ設定等はデモ対象外。

## ルーティング

`/demo` 配下にクライアントサイドの並行ルートツリーを置く。

```text
/demo                         → /demo/dashboard へリダイレクト
/demo/dashboard               ダッシュボード
/demo/transactions            収支一覧
/demo/transactions/new        収支追加
/demo/transactions/[id]/edit  収支編集
/demo/categories              カテゴリ一覧
/demo/categories/new          カテゴリ追加
/demo/categories/[id]/edit    カテゴリ編集
```

- `/demo` は公開パス（`lib/route-access.ts` の `PUBLIC_PATH_PREFIXES` に追加）。未ログインでもアクセス可能。
- ログイン済みユーザーがアクセスしても閲覧可（認証分岐なし）。

## データモデル

インメモリ状態 `DemoState`（`lib/demo/store.ts`）:

```ts
type DemoState = {
  household: { id: string; name: string; period_start_day: number };
  currentUserId: string;          // スコープ（全体/自分）判定の基準ユーザー
  members: MemberInfo[];          // 2名（「あなた」「パートナー」）
  categories: Category[];         // デフォルト＋カスタム混在（is_default で区別）
  transactions: Transaction[];    // 当期内のサンプル数件
};
```

- 型は本番と同じ `Category` / `Transaction`（`types/index.ts`）を使用。`household_id` は固定のデモID、`created_at` は ISO 文字列。
- `id` は `crypto.randomUUID()` で生成（カテゴリIDは収支フォームのZod検証で uuid を要求されるため必須）。
- 初期データ（サンプル）は `lib/demo/seed.ts` の `createSeedState()` が当期（今月）内の日付で生成する。

### 純粋ロジック（テスト対象）

`lib/demo/store.ts`:

- `createDemoState()` — seed を組み立てた初期状態を返す
- `addTransaction(state, input, createdBy?)` / `editTransaction(state, id, input)` / `removeTransaction(state, id)`
- `addCategory(state, input)` / `editCategory(state, id, input)` / `removeCategory(state, id)`
  - `is_default = true` のカテゴリに対する編集・削除は no-op（状態を変えない）
  - カテゴリ削除時、参照していた収支の `category_id` を `null` にする（本番の on delete set null を再現）
- `selectTransactionRows(state)` — 収支に `category: { name, color } | null` を join した行を返す（ダッシュボード／一覧／マトリクスの入力）

集計は既存の純粋ヘルパーを再利用: `getPeriodRange`/`shiftPeriod`/`formatPeriodLabel`（`lib/period.ts`）、`buildCategoryMemberMatrix`（`lib/category-matrix.ts`）、`groupByDate`/`yen`/`formatDayLabel`（`lib/format.ts`）。

## UI の動作・バリデーション

- `components/features/demo/demo-provider.tsx`（Context）が `DemoState` を `useState` で保持し、`useDemo()` でデータと操作を公開する。
- フォーム（`TransactionForm`/`CategoryForm`）はそのまま再利用。`action` には Context 側のアダプタを渡す。アダプタは本番と同じ Zod スキーマ（`transactionSchema`/`categorySchema`）で FormData を検証し、失敗時は `{ error }` を返してフォームにエラー表示、成功時は状態を更新して一覧へ `router.push` する。
- 削除はクライアント関数（フォーム action）で状態から除去。カテゴリ削除は確認ダイアログ（既存 `DeleteCategoryButton` を再利用）。
- 常時バナー（`demo-banner.tsx`）: 「これはデモです。入力したデータは保存されず、ページを更新すると消えます」＋「無料で登録して保存」ボタン（`/register`）。
- 専用ナビ（`demo-header.tsx` / `demo-tab-bar.tsx`）: リンク先はすべて `/demo/*`。認証依存の本番 `AppHeader`/`MobileTabBar` は流用しない。
- ランディング（`landing-header.tsx` / `hero.tsx`）に「デモを試す」導線（→ `/demo`）を追加。

## Supabase テーブル・RLS ポリシー

なし。デモモードは Supabase に一切アクセスしない。

## 未解決の課題

- 月次分析（`/analytics`）・メンバー別アクティビティをデモに含めるかは将来検討。
- 国際化や金額フォーマットは本番準拠（円・日本語固定）。
