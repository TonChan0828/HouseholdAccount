# 年間分析 仕様書

## 概要

分析画面 `/analytics` に「月次 / 年間」の切り替えタブを追加し、**年単位で家計を振り返る年間ビュー**を提供する。
現行の月次ビュー（当期＋直近6期）では「1年でいくら使ったか」「前年と比べてどうか」「どのカテゴリが増えたか」が見えないため、
12期ぶんの推移・年間合計 KPI・カテゴリ別年間支出・前年比較・年間アドバイスをまとめて表示する。
新規 DB テーブル・マイグレーションは不要で、既存の期間計算（`lib/period.ts`）と集計（`lib/analytics.ts`）を再利用する。

## 対象ユーザー・前提条件

- ログイン済みかつ家計簿グループ選択済みのユーザー（他の分析と同じ `requireDashboardContext`）。
- 集計はグループ全体（メンバー別フィルタなし）。
- デモモードは `/demo/analytics` で年間ビューを閲覧できる。前年12か月と当年の経過月の合成データを使い、デモのメモリ内状態だけで集計する。

## 年の定義（締め日考慮の暦年）

既存の期間規約（`getPeriodRange`: 開始日以降はその月から期が始まる）に合わせる。

- **Y年 = 開始月が Y年1月〜12月 の12期** = `[Y/01/startDay, (Y+1)/01/startDay)`
  - 締め日1日: 2026/01/01〜2026/12/31（純粋な暦年）
  - 締め日25日: 2026/01/25〜2027/01/24
- 各期のラベルは開始月で「1月」〜「12月」。
- 既定の年（`?year` 未指定・不正）は「今日を含む期の開始年」。締め日25日で 2026/01/10 なら当期は 2025/12/25〜 なので 2025年。

## 画面・UI

### ルーティング

- `/analytics` … 月次ビュー（現行のまま）
- `/analytics?view=year` … 年間ビュー（既定の年）
- `/analytics?view=year&year=2025` … 指定年の年間ビュー（`^\d{4}$` のみ受理）

### 表示内容（年間ビュー）

- ページヘッダー下に「月次 / 年間」タブ（リンク、選択中は `aria-current="page"`）。月次ビューにも同じタブを表示。
- 年ナビ（`MonthNav` 流用）: ラベル「2026年」、前後は `?view=year&year=±1`。
- KPI リボン: 年間収入 / 年間支出 / 年間収支 / 貯蓄率（%）
- 年間アドバイス（ルールベース、最大5件）
- ① 月別推移（12期）: 既存 `TrendBars`（ラベル「1月」〜「12月」）
- ② カテゴリ別支出（年間）: 既存 `CategoryBreakdown`
- ③ 前年比較: 年間支出/収入の前年同期比と、カテゴリ別の増減リスト（増加=支出色、減少=収入色、差額の大きい順）
  - 当年が進行中の場合は「前年同期」（当年の経過期数と同じ期数ぶんの前年）と比較する
  - 前年データが無い場合は「前年のデータがありません。」

### 「経過期数」

- 期の開始日が今日以前の期を経過期とする（過去年=12、未来年=0）。
- 月平均支出・前年同期の範囲に使う。

## データモデル

```typescript
// lib/period.ts
function getYearRanges(year: number, startDay: number): PeriodRange[]; // 12期
function yearFromParam(year: string | undefined, startDay: number, now?: Date): number;

// lib/yearly-analytics.ts
type YearSummary = {
  months: PeriodSummary[];      // 12期（label: "1月"〜"12月"）
  income: number;
  expense: number;
  balance: number;              // income - expense
  savingsRate: number | null;   // income > 0 のとき (income-expense)/income
  elapsed: number;              // 経過期数 0〜12
  avgExpense: number;           // expense / elapsed（elapsed=0 なら 0）を四捨五入
  peakExpense: { label: string; amount: number } | null; // 支出最多の期（支出0なら null）
};
function countElapsed(ranges: PeriodRange[], today: string): number;
function summarizeYear(txs: TxLite[], ranges: PeriodRange[], today: string): YearSummary;

type CategoryYoY = {
  categoryId: string | null;
  name: string;
  color: string;
  amount: number;       // 当年
  prevAmount: number;   // 前年同期
  diff: number;         // amount - prevAmount
  ratio: number | null; // prevAmount > 0 のとき diff / prevAmount
};
function compareCategoryYoY(current: CategorySlice[], prev: CategorySlice[]): CategoryYoY[]; // |diff| 降順、diff=0 は除外

// lib/advice.ts
type YearlyAdviceInput = {
  income: number; expense: number;
  prevIncome: number; prevExpense: number; // 前年同期
  elapsed: number;                         // 経過期数（突出月ルールの判定条件）
  peakExpense: { label: string; amount: number } | null;
  avgExpense: number;
  categoryYoY: CategoryYoY[];
};
function buildYearlyAdvice(input: YearlyAdviceInput): Advice[];
```

## 年間アドバイスのルール

しきい値は `lib/advice.ts` の定数に切り出す。深刻度ソート・最大5件は月次と同じ。

- データなし（income, expense とも0）→ info「この年の収支はまだありません」のみ
- 年間赤字: `expense > income` → **alert**
- 年間貯蓄率: `income > 0` かつ `rate < 10%` → **warn**、`rate ≥ 20%` → **good**
- 前年同期比 支出: `prevExpense > 0` かつ `expense > prevExpense × 1.10` → **warn**、`< × 0.90` → **good**
- 支出が突出した月: `peakExpense.amount ≥ avgExpense × 1.5` かつ経過2期以上 → **info**「{label}の支出が突出しています」
- 前年比で増えたカテゴリ: `prevAmount > 0` かつ `diff ≥ ¥10,000` かつ `ratio ≥ 20%` → **warn**（増加額順・最大2件）

## Supabase

### 使用テーブル

- `transactions`（前年1期目〜当年末の24期ぶんを `fetchTransactionsInRange` で1回取得）
- `categories` は不要（カテゴリ名/色は取引の join から取る）

### RLS ポリシー

- 変更なし（既存の household スコープの SELECT ポリシーに従う）

## 未解決の課題

- メンバー別の年間分析
- 予算の年間予実（予算が月次固定のため、年間予算の定義が別途必要）
- 年度（4月始まり等）の選択
