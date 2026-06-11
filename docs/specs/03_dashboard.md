# ダッシュボード 仕様書

## 概要

ログイン後の起点画面（`/`）。アクティブな household の「当期間」の収支を一目で把握する。
月次サマリー（収入計・支出計・収支差）、メンバー別カテゴリマトリクス、最近の取引を表示し、
サマリーと最近の取引は「全体/自分」で絞り込める。
期間の移動や全件閲覧・追加は収支記録（`/transactions`）に委譲する。

## 対象ユーザー・前提条件

- ログイン済みかつアクティブな household を選択しているメンバー
- アクティブ household 未選択なら `/households` へ誘導
- すべて `household_id` でスコープ（`lib/household.ts#getActiveHouseholdId`）

## 月の区切り（期間）

- 収支記録と同じ締め日モデルを流用する（`households.period_start_day`、`lib/period.ts`）
- ダッシュボードは**当期間固定**（`getPeriodRange(今日, period_start_day)`）。期間ナビは置かない

## 画面・UI

### レイアウト

```text
ダッシュボード        [収支を記録] [グループ選択]
2026/06/01 〜 06/30

[ 全体 | 自分 ]            ← スコープトグル

┌─収入───┐ ┌─支出───┐ ┌─収支───┐
│¥320,000│ │¥185,400│ │+¥134,600│
└────────┘ └────────┘ └────────┘

メンバー別カテゴリ
【支出】
 カテゴリ   太郎      花子      合計
 ● 食費    ¥40,000  ¥30,000  ¥70,000
 ● 交通費   ¥8,000   ¥5,000  ¥13,000
 合計      ¥48,000  ¥35,000  ¥83,000
【収入】
 カテゴリ   太郎      花子      合計
 ● 給与   ¥300,000 ¥250,000 ¥550,000
 合計     ¥300,000 ¥250,000 ¥550,000

最近の取引                        すべて見る →
 06/08  ● 食費   ランチ            -¥1,200
 06/07  ● 給与                   +¥320,000
 …（最大5件 / 0件ならプレースホルダ）
```

### 表示内容

- 期間ラベル（`formatPeriodLabel`）
- スコープトグル `全体 | 自分`（`?scope=all|mine`、既定 `all`）。現在のスコープを強調
- サマリーカード: 収入計（緑）・支出計（赤）・収支差
- メンバー別カテゴリマトリクス: 行=カテゴリ / 列=メンバー＋合計列。【支出】→【収入】の2セクション構成で、各セクションに合計行（メンバーごと）を持つ
  - 当期間に取引のあるカテゴリのみ行として表示（行は合計降順）。`category_id` が null の取引は「未分類」行に集約
  - セクション振り分けは取引の `type` で行う（`both` 型カテゴリは両セクションに現れ得る）
  - 列はメンバーの `joined_at` 順。取引ゼロのメンバーも列に出す（セルは薄色の `-` 表示）
  - **scope トグルの影響を受けず常に全メンバーを表示**（メンバー比較が目的のため）
  - 行が0のセクションは描画しない。両セクションとも空ならマトリクス全体を描画しない
  - モバイルは横スクロール（先頭のカテゴリ列は固定）
- 最近の取引: 当期間の最新5件（`date desc, created_at desc`）。各行に日付・カテゴリ（色ドット＋名前 / 無ければ「未分類」）・メモ・金額（収入=緑/支出=赤）。「すべて見る」で `/transactions`

### インタラクション・バリデーション

- スコープ `mine` のとき `created_by = auth.uid()` で絞る。サマリー・最近の取引に適用（マトリクスには適用しない）。絞り込みは DB クエリではなく JS 側で行う（マトリクスが全メンバー分を必要とするため、取引は無条件で1回取得して使い分ける）
- トグルはリンク（`/` ?scope=...）。Server Component が `searchParams.scope` を読む
- 入力フォームは無し（閲覧専用画面）

## データモデル

```typescript
// 集計（ページ内で算出）
type Summary = { income: number; expense: number; balance: number };

// lib/category-matrix.ts（新規・純関数）
type MatrixTx = {
  amount: number;
  type: "income" | "expense";
  created_by: string;
  category_id: string | null;
  category: { name: string; color: string | null } | null;
};
type MatrixRow = {
  categoryId: string | null; // null = 未分類
  name: string;
  color: string;
  cells: number[]; // members と同順・同長。取引なしは 0
  total: number;   // 合計列
};
type MatrixSection = {
  rows: MatrixRow[];      // 合計降順
  memberTotals: number[]; // 合計行
  total: number;
};
type CategoryMemberMatrix = {
  members: { userId: string; displayName: string }[];
  expense: MatrixSection;
  income: MatrixSection;
};
buildCategoryMemberMatrix(txs: MatrixTx[], members: MemberInfo[]): CategoryMemberMatrix

// lib/period.ts（既存・流用）
getPeriodRange(refDate, startDay) / formatPeriodLabel(range) / toISODate(d)
```

## Supabase

### 使用テーブル

- `households`（`period_start_day` 読み取り）
- `transactions`（当期間で取得）＋ `categories`（join）
- `household_members`（メンバー一覧、`joined_at` 順）＋ `profiles`（display_name 解決）

### RLS ポリシー（既存）

- `transactions` / `categories` select: `is_household_member(household_id)`

### クエリ（Server Component）

```typescript
// 当期間の収支（scope によらず household_id スコープのみで取得）
const q = supabase
  .from("transactions")
  .select("id, amount, type, date, memo, created_by, category_id, category:categories(name, color)")
  .eq("household_id", activeId)
  .gte("date", isoStart)
  .lt("date", isoEnd)
  .order("date", { ascending: false })
  .order("created_at", { ascending: false });
// scope=mine の絞り込みは JS 側: rows.filter(t => t.created_by === user.id)
// サマリー・最近の取引 → 絞り込み後 / マトリクス → 全件 + メンバー一覧から構築
```

Server Action は不要（閲覧専用）。

## コンポーネント

- `components/features/dashboard/summary-cards.tsx` — 収入/支出/収支の表示（presentational）
- `components/features/dashboard/scope-toggle.tsx` — 全体/自分のリンク（presentational、現在値を強調）
- `components/features/dashboard/category-member-matrix.tsx` — メンバー別カテゴリマトリクス（presentational、`lib/category-matrix.ts` の集計結果を表示）
- 最近の取引はページ内でレンダリング（`/transactions` の行表示と整合）
- `/transactions` の既存コードは変更しない（DRY のための無関係改修を避ける）

## テスト

- Unit: `lib/category-matrix.ts#buildCategoryMemberMatrix`（セクション振り分け・合計行/列・列順維持・未分類集約・脱退者除外・0件時）
- Component: `SummaryCards`（収入/支出/収支の金額表示）、`ScopeToggle`（全体/自分のリンク・現在値の強調）、`CategoryMemberMatrix`（セクション見出し・カテゴリ行・合計・ゼロセル `-`・空時非描画）
- E2E: グループ作成 → 収支追加 → ダッシュボードでサマリーに金額反映 → 全体/自分トグルの遷移 → マトリクスにカテゴリ行と金額が表示・scope=mine でも全メンバー表示のまま

## 未解決の課題

- 脱退メンバーの取引はマトリクスから除外されるため、scope=all のサマリー合計とマトリクス総計が乖離し得る（将来「その他」列で吸収する選択肢あり）
- カテゴリ別内訳・推移グラフは分析（05）の領域でダッシュボードには含めない
