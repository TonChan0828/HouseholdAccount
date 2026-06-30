# 33. 月末着地予測（End-of-Month Landing Forecast）

## 機能概要・目的

当期（締め日区切りの「今月」）の途中時点で、**期末にいくらで着地するか**（収入・支出・収支）を予測してダッシュボードに表示する。使いすぎ・予算超過に月の途中で気づけるようにすることが目的。

## 設計の肝：固定/変動の分離（ハイブリッド方式）

定期収支（固定費・固定収入）は締め日（期首）に `generate_due_recurring` で自動計上される（spec 26）。そのため**支出合計をそのまま日割り外挿すると、期首に計上済みの家賃などを「毎日発生する」と誤認し、数倍に過大予測してしまう**。

これを避けるため、当期トランザクションを `transactions.recurring_id` の有無で分離する:

- `recurring_id != null` … 固定（定期由来）。期中で増減しないため **満額そのまま**。
- `recurring_id == null` … 変動。**経過日数で日割りし、総日数に外挿**。

## データモデル（入出力の型）

`lib/forecast.ts`（純関数）。

```ts
type ForecastTx = {
  amount: number;
  type: "income" | "expense";
  recurring_id: string | null;
};

type Forecast = {
  totalDays: number;      // 期間の総日数 (end - start)
  daysElapsed: number;    // 経過日数。[1, totalDays] にクランプ
  daysRemaining: number;  // totalDays - daysElapsed
  actualIncome: number;   // 実績（固定+変動）
  actualExpense: number;
  projectedIncome: number;   // round(固定収入 + 変動収入 × factor)
  projectedExpense: number;  // round(固定支出 + 変動支出 × factor)
  projectedBalance: number;  // projectedIncome - projectedExpense
  factor: number;            // 変動に掛ける外挿係数 totalDays/daysElapsed (>= 1)
};

function buildForecast(txs: ForecastTx[], range: PeriodRange, today: Date): Forecast

type ForecastBudget = {
  totalBudget: number;    // 予算設定済みカテゴリの予算合計
  projectedSpent: number; // 同カテゴリの着地支出（固定満額 + 変動×factor）
  overBy: number;         // max(projectedSpent - totalBudget, 0)
  willOverrun: boolean;   // projectedSpent > totalBudget
};

// 予算未設定（amount>0 のカテゴリが無い）なら null。forecast.factor を再利用する。
function buildForecastBudget(
  budgets: { category_id: string; amount: number }[],
  txs: { amount: number; type: "income" | "expense"; recurring_id: string | null; category_id: string | null }[],
  forecast: Forecast,
): ForecastBudget | null
```

### 算出式

期間は `lib/period.ts` の半開区間 `[start, end)`・UTC 真夜中基準を踏襲。

- `totalDays = (end - start) / 86_400_000`
- `daysElapsed = floor((today の UTC 日 - start) / 86_400_000) + 1` を `[1, totalDays]` にクランプ
- `factor = totalDays / daysElapsed`
- `projectedExpense = round(固定支出合計 + 変動支出合計 × factor)`（収入も同様）

## UI の動作・バリデーション

- 表示場所: **ダッシュボード**（`/dashboard`）の `SummaryCards` 直後の専用カード `ForecastCard`。
- **当期表示時のみ**描画する（既存 `viewingCurrent` 判定を流用）。過去/未来期間（`?ref=`）では非表示。期末以降はクランプにより予測＝実績。
- スコープは **世帯全体**（`scope=mine` でも全体を表示）。予算カードと整合させるため。
- 表示内容:
  - 着地支出 `projectedExpense`（補助に「実績 ¥… / 残り N 日」）
  - 着地収支 `projectedBalance`（収入−支出の符号で色分け）
  - 予算連携: `ForecastBudget.willOverrun` のとき「このペースだと予算を ¥overBy 超過して着地します」を警告色で表示。

## Supabase テーブル・RLS ポリシー

- **新規テーブルなし**。`transactions`（`recurring_id` 既存）・`budgets`（既存）を参照するのみ。マイグレーション不要。
- 既存の household スコープ RLS に従う（`household_members` に属する `household_id` のみ取得）。

## 未解決の課題

- **手動入力の固定費**（定期登録していない家賃など）は `recurring_id` を持たないため変動扱いとなり外挿される。期首にまとめて記帳するユーザーでは過大予測になりうる。将来的にカテゴリ種別や「固定費」フラグでの分離を検討。
- 変動支出の外挿は線形（日割り）。給料日後にまとめ買いするような偏りは反映しない。
- 期序盤（経過日数が少ない）は外挿係数が大きく予測がぶれやすい。UI で「残り N 日」を併記し精度の目安を示す。
