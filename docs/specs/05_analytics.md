# 月次分析 仕様書

## 概要

アクティブな household の収支を時系列とカテゴリ内訳で可視化する閲覧専用画面（`/analytics`）。
直近6期分の収入・支出の推移（棒グラフ）と、当期の支出のカテゴリ別内訳（円グラフ）を表示する。
期間の移動はできるが、追加・編集は収支記録（`/transactions`）に委譲する。

## 対象ユーザー・前提条件

- ログイン済みかつアクティブな household を選択しているメンバー
- アクティブ household 未選択なら `/households` へ誘導
- すべて `household_id` でスコープ（`lib/household.ts#getActiveHouseholdId`）
- 集計はメンバー横断（全体）。メンバー別切り替えは機能07（auth.users 連携）後に対応する

## 月の区切り（期間）

- 収支記録・ダッシュボードと同じ締め日モデルを流用する（`households.period_start_day`、`lib/period.ts`）
- `?ref=YYYY-MM-DD` で基準期を移動（既定は今日を含む当期）。`getPeriodRange` / `shiftPeriod` を使う
- 推移グラフは「基準期を末尾とする直近6期」、円グラフは「基準期（当期）」を対象とする

## 画面・UI

### レイアウト

```text
分析                                   [グループ選択]
◀   2026/06/01 〜 06/30   ▶              ← 期間ナビ（MonthNav 再利用）

月別推移（直近6期）
┌───────────────────────────────────┐
│ 収入(緑) / 支出(赤) の棒グラフ × 6期   │   ← BarChart
└───────────────────────────────────┘

カテゴリ別支出（当期）
┌──────────┐   ● 食費    ¥32,000
│  円グラフ  │   ● 日用品  ¥12,500
└──────────┘   ● 未分類  ¥3,000
              …（カテゴリの color を使用 / 当期の支出が0件ならプレースホルダ）
```

### 表示内容

- 期間ラベル（`formatPeriodLabel`）と前後ナビ（`MonthNav`、`?ref=` 移動）
- 月別推移: 直近6期それぞれの収入計（緑）・支出計（赤）を並べた棒グラフ。X軸ラベルは各期の表示（例 `06/01〜`）
- カテゴリ別支出: 当期の支出をカテゴリごとに集計した円グラフ＋凡例（色ドット・カテゴリ名・金額）。カテゴリ未設定は「未分類」（灰）に集約

### インタラクション・バリデーション

- 入力フォームは無し（閲覧専用画面）
- 期間ナビはリンク（`/analytics?ref=...`）。Server Component が `searchParams.ref` を読む
- データ0件: 推移グラフは各期0で描画、円グラフは「当期の支出はまだありません」プレースホルダ

## データモデル

```typescript
// lib/analytics.ts（新規・純関数。集計ロジックをここに集約し TDD する）

type TxLite = {
  amount: number;
  type: "income" | "expense";
  date: string; // YYYY-MM-DD
  category_id: string | null;
  category: { name: string; color: string | null } | null;
};

// 月別推移の1期ぶん
export type PeriodSummary = {
  label: string; // X軸ラベル（例 "06/01〜"）
  income: number;
  expense: number;
};

// カテゴリ別内訳の1項目
export type CategorySlice = {
  categoryId: string | null;
  name: string; // 未設定は "未分類"
  color: string; // 未設定は灰
  amount: number;
};

// 直近 periods 期ぶんの収入/支出を期バケットへ集計
export function summarizeTrend(
  txs: TxLite[],
  ranges: { start: Date; end: Date }[],
): PeriodSummary[];

// 当期の支出をカテゴリ別に集計（金額降順）
export function summarizeCategoryExpense(txs: TxLite[]): CategorySlice[];
```

## Supabase

### 使用テーブル

- `households`（`period_start_day` 読み取り）
- `transactions`（直近6期の範囲で取得）＋ `categories`（join: name, color）

### RLS ポリシー（既存）

- `transactions` / `categories` select: `is_household_member(household_id)`

### クエリ（Server Component）

```typescript
// 基準期と直近6期の範囲を算出
const base = getPeriodRange(refFromParam(ref), startDay);
const ranges = Array.from({ length: 6 }, (_, i) =>
  shiftPeriod(base, i - 5, startDay),
); // [5期前 … 当期]
const isoStart = toISODate(ranges[0].start);
const isoEnd = toISODate(base.end);

// 6期ぶんを1クエリで取得し、集計は JS（lib/analytics.ts）で行う
const { data } = await supabase
  .from("transactions")
  .select("amount, type, date, category_id, category:categories(name, color)")
  .eq("household_id", householdId)
  .gte("date", isoStart)
  .lt("date", isoEnd);

const trend = summarizeTrend(txs, ranges);
const categories = summarizeCategoryExpense(
  txs.filter((t) => t.date >= toISODate(base.start) && t.date < isoEnd),
);
```

Server Action は不要（閲覧専用）。集計は DB ではなく `lib/analytics.ts` の純関数で行い、ユニットテストで検証する。

## コンポーネント

- `lib/analytics.ts` — 集計の純関数（`summarizeTrend` / `summarizeCategoryExpense`）。TDD 対象
- `components/features/charts/trend-bar-chart.tsx` — 収入/支出の棒グラフ（`"use client"`、presentational）
- `components/features/charts/category-pie-chart.tsx` — カテゴリ別円グラフ＋凡例（`"use client"`、presentational、空データでプレースホルダ）
- 期間ナビは既存 `components/features/transactions/month-nav.tsx` を再利用
- `/transactions`・ダッシュボードの既存コードは変更しない

## テスト

- Unit（`lib/analytics.test.ts`）: `summarizeTrend`（6期バケット集計・期境界・空データ）、`summarizeCategoryExpense`（カテゴリ集計・未分類集約・降順・空データ）
- Component: `CategoryPieChart` の空データ時プレースホルダ表示（Recharts 描画自体は検証しない軽い表示確認）
- E2E（`e2e/analytics.spec.ts`）: グループ作成 → 収支追加 → `/analytics` で推移・カテゴリ内訳に反映 → 期間ナビ遷移

## 未解決の課題

- メンバー別切り替え（機能07 で auth.users 連携後に対応）
- 収入のカテゴリ別内訳トグル（当面は支出のみ）
- 推移グラフの期数の可変化（当面は6期固定）
