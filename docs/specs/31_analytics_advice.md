# 家計アドバイス（ルールベース） 仕様書

## 概要

分析画面 `/analytics` の上部に、当期の家計データから自動生成した**ルールベースのアドバイス**を表示する機能。単にグラフを見せるだけでなく、「何が起きているか／どう改善できるか／何が良かったか」をアプリ側から能動的に提示し、家計改善のきっかけを与える。新規 DB テーブルは不要で、既存の集計（trend / カテゴリ別支出 / 予実）を再利用して純関数で評価する。

## 対象ユーザー・前提条件

- ログイン済みかつ家計簿グループ（household）選択済みのユーザー。
- 未ログインは `/login`、グループ未選択は `/households` へリダイレクト（他ダッシュボードページと同じ）。
- アドバイスはグループ全体のデータ（世帯全体の当期収支）に基づく。メンバー別フィルタは適用しない。

## 機能要件

- アドバイスは決定的な**ルールベース**（AI/LLM は使わない）。同じ入力なら同じ出力。
- 4系統のルールを評価する: ①予算超過の検知 ②支出トレンド ③カテゴリ集中度 ④貯蓄率・収支バランス。
- 各アドバイスは深刻度 `severity`（`alert` > `warn` > `good` > `info`）を持ち、深刻度優先で安定ソートし**上位最大5件**に絞って表示する。
- トーンは警告だけでなく改善提案・称賛（good）も含めるバランス型。
- 分析対象データが無い（当期トランザクションなし）場合は info を1件だけ返す。

## ルール定義（しきい値）

しきい値は `lib/advice.ts` 先頭の定数に切り出す。

### ④ 貯蓄率・収支バランス（rate = (income - expense) / income）

- 赤字: `expense > income` → **alert**「今期は支出が収入を ¥X 上回っています」
- 貯蓄率低下: `income > 0` かつ `0 ≤ rate < 0.10` → **warn**「貯蓄率が X% と低めです」
- 貯蓄率良好: `rate ≥ 0.20` → **good**「貯蓄率 X% を達成しています」
- 改善: `prevIncome > 0` かつ 今期 rate > 前期 rate + 0.05 → **good**「貯蓄率が前期より改善しています」

### ① 予算超過の検知（`BudgetSummary` を使用）

- カテゴリ超過: `row.over` の各カテゴリ → **alert**「『{name}』が予算を ¥X 超過しています」（超過額降順・最大2件）
- 全体超過: `budget.over` → **warn**「予算合計を ¥X 超過しています」
- 予算内good: `rows` に予算設定済みがあり超過0件 → **good**「すべてのカテゴリが予算内です」

### ③ カテゴリ集中度（固定費除外）

- **固定費は母数から除外する**。家賃などの一定の固定費がトップを占めるのは当然で、指摘しても行動に繋がらないため。固定費＝定期収支（`recurring_transactions`、`is_active=true` かつ `type='expense'`）に紐づくカテゴリ。
- 変動費のみで判定: `variableTotal = Σ(固定費以外のカテゴリ支出)`、`topShare = 変動費トップ / variableTotal`
- `variableTotal > 0` かつ **変動費カテゴリが2つ以上**（1つだけだと自明な100%集中になるため抑制）かつ `topShare ≥ 0.50` → **info**「固定費を除く支出の X% が『{name}』に集中しています」

### ② 支出トレンド

- 前期比増加: `prevExpense > 0` かつ `expense > prevExpense * 1.20` → **warn**「支出が前期比 +X% 増えています」
- 前期比減少: `prevExpense > 0` かつ `expense < prevExpense * 0.90` → **good**「支出を前期比 X% 抑えられています」
- 3期連続増加: `expenseTrend` 末尾3期が単調増加 → **warn**「3期連続で支出が増加しています」

### ⑤ カテゴリ別スパイク（いつもより増えた支出）

カテゴリ別の期別推移（`categoryTrends`）から、当期が直近平均を大きく上回ったカテゴリだけを指摘する。家賃のような一定の固定費は発火しないため、集中度ルールより行動に繋がりやすい。

- 各カテゴリで `baseline = mean(当期を除く各期の支出)`、`current = 当期の支出`。
- `baseline > 0`（過去実績あり）かつ `current > baseline * 1.4` かつ `current - baseline ≥ ¥5,000`（ノイズ床）→ **warn**「『{name}』が直近の平均より +X% 増えています」
- 増加額の大きい順に最大2件。
- ※ スパイクは固定費でも有用（家賃の値上げ等）なので固定費除外はしない。

## データモデル（lib/advice.ts）

```typescript
type AdviceSeverity = "alert" | "warn" | "good" | "info";

type Advice = {
  id: string;            // ルール識別子（重複排除・テスト用）
  severity: AdviceSeverity;
  title: string;         // 一行サマリ
  detail: string;        // 改善提案 or 補足（称賛時は労い）
};

type AdviceInput = {
  income: number;
  expense: number;
  prevIncome: number;
  prevExpense: number;
  expenseTrend: number[];      // 直近6期の支出（古い→新しい、当期含む）
  categories: CategorySlice[]; // 当期カテゴリ別支出（金額降順）
  fixedCategoryIds: string[];  // 固定費カテゴリ（定期支出に紐づく）→集中度の母数から除外
  categoryTrends: CategoryTrend[]; // カテゴリ別の期別推移（当期が末尾）→スパイク検知
  budget: BudgetSummary;       // buildBudgetRows の出力
};

function buildAdvice(input: AdviceInput): Advice[];
```

純関数・副作用なし。既存 `lib/analytics.ts#summarizeCategoryExpense` / `summarizeTrend`、`lib/budget.ts#buildBudgetRows` の出力を入力に取る。

## 画面・UI

### `/analytics` への追加

- KPIリボンの直下に新セクション `SectionHeading`「家計アドバイス」＋ `AdviceSection`。
- `AdviceSection`（Server Component）は `advice: Advice[]` を受け取りカード列で表示。
- severity → 見た目:
  - `alert`: 赤（`bg-expense-soft`/`text-expense`）・アイコン `TriangleAlert`
  - `warn`: 注意（neutral 強調）・アイコン `TrendingUp`
  - `good`: 緑（`bg-income-soft`/`text-income`）・アイコン `CheckCircle2` / `PiggyBank`
  - `info`: neutral・アイコン `Info`
- 各カードは `Surface variant="flat"` ベース、title（font-medium）＋ detail（text-sm text-muted-foreground）。
- 既存のスタッガードフェードインを踏襲。アドバイス0件時はセクション自体を描画しない（実質 info が必ず1件返るため空にはならない）。

## Supabase

- 新規テーブル・RLS・マイグレーションなし。
- 分析ページで `budgets`（`category_id, amount`）、`categories`（`id, name, color`）、`recurring_transactions`（`category_id, type`／`is_active=true`）を household スコープで追加取得する。

## 未解決の課題

- 月末着地予測（当期が進行中の場合のプロレーションによる超過予測）は本フェーズではスコープ外。
- ダッシュボードへのアドバイス要約表示・専用ページ化は将来拡張。
- ユーザーによるしきい値カスタマイズは未対応（定数固定）。
