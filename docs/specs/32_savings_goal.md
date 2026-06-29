# 貯金目標 仕様書

## 概要

家計簿グループの貯金目標を1つ設定し、目標額に対する進捗をダッシュボード上で可視化する機能。進捗（現在の貯金額）は、目標の**開始日以降・今日までの世帯全体の収支差額（収入 − 支出）**から自動算出する。専用の積立記録は持たず、既存の `transactions` から導出する。任意で期日を設定でき、期日があるときは「あと何ヶ月・月いくらペースが必要か」を表示する。共有家計簿の「みんなで貯める」体験を後押しする。

## 対象ユーザー・前提条件

- ログイン済みかつ家計簿グループ（household）を選択済みのユーザー。
- 未ログインは `/login`、グループ未選択は `/households` へリダイレクト（他ダッシュボードページと同じ）。
- 目標はグループ単位で共有され、メンバー全員が設定・編集・解除できる。

## 機能要件

- **目標はグループに1つだけ**（`savings_goals.household_id` を UNIQUE）。複数同時保持は不可。
- 進捗（貯金額）= 開始日 `start_date` 以降・今日までの**世帯全体**の `(収入合計 − 支出合計)`。
  - scope（mine/all）には依存せず、常に世帯全体で計算する。
  - 貯金額が負（支出超過）になりうる。その場合は進捗0%・残額は目標全額として扱う。
- 期日 `target_date` は**任意（NULL 可）**。
  - 期日なし: 進捗率・残額のみ表示（ペース表示なし）。
  - 期日あり: ペース表示（残り月数・月あたり必要額）を追加。
- 目標額 `target_amount` は1円以上の整数。金額欄は四則演算式入力に対応（`evaluateAmount`、spec 25 と同様）。
- 表示はダッシュボードのみ（専用ページは設けない）。

## 画面・UI

### ダッシュボード統合（貯金目標カード）

`components/features/dashboard/savings-goal-card.tsx`。配置は `SummaryCards` の直後。

- **目標未設定**: 空状態（説明文＋「目標を設定」ボタン）。ボタンでフォームダイアログを開く。
- **目標設定済み**:
  - 目標名（例: 旅行資金）。
  - 進捗バー（0〜100% で頭打ち。達成時は満杯＋達成表現）。
  - 「貯金額 / 目標額」「N%」「残り◯円」（達成済みなら「達成 🎉」）。
  - ペース（期日ありのとき）:
    - 達成済み → 「達成 🎉」
    - 期日超過かつ未達 → 「期日超過（あと◯円）」
    - それ以外 → 「期日まであとMヶ月・月◯円ペース」
  - 「編集」「解除」操作。

### フォーム（ダイアログ）

- 項目: 目標名（必須）／目標額（必須・1円以上・式入力可）／開始日（必須・既定は今日）／期日（任意・空可）。
- 期日は開始日より後であること（同日以前はバリデーションエラー）。
- 保存で upsert、解除で削除。

### インタラクション・バリデーション

- 目標名は空不可（trim 後1文字以上）。
- 目標額は `evaluateAmount` で評価し四捨五入、1円以上の整数。
- 期日は未入力可。入力時は `target_date > start_date`。

## データモデル

### savings_goals テーブル

```sql
create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  target_amount integer not null check (target_amount >= 1),
  start_date date not null,
  target_date date,
  created_at timestamptz not null default now(),
  unique (household_id)
);
create index savings_goals_household_idx on public.savings_goals (household_id);
```

### 進捗算出（lib/savings-goal.ts 純関数）

```typescript
type SavingsGoalInput = {
  name: string;
  targetAmount: number;
  startDate: string;   // YYYY-MM-DD
  targetDate: string | null;
};

type SavingsProgress = {
  name: string;
  targetAmount: number;
  saved: number;          // 開始日以降の (収入−支出)。負になりうる
  pct: number;            // round(max(saved,0)/target*100)。上限なし（表示側で頭打ち）
  remaining: number;      // max(target − saved, 0)
  reached: boolean;       // saved >= target
  // 期日あり（targetDate != null）かつ未達のときのみ pace を持つ
  pace: {
    monthsLeft: number;        // max(1, ceil(残日数/30))
    requiredPerMonth: number;  // ceil(remaining / monthsLeft)
    overdue: boolean;          // today > targetDate かつ未達
  } | null;
};

function buildSavingsProgress(
  goal: SavingsGoalInput,
  saved: number,     // 呼び出し側で集計済みの (収入−支出)
  today: Date,
): SavingsProgress;
```

- `saved` の集計はページ側で行う（`start_date` 以降・今日までの世帯全体の `amount, type` を取得し JS で合算。既存の集計と同流儀）。
- 残り月数は `monthsLeft = max(1, ceil((targetDate − today)の日数 / 30))`。
- ペースは `targetDate` が `null` のとき `null`。達成済み（`reached`）のときも `null`。

## Supabase

### RLS ポリシー

- `savings_goals` の全操作（select / insert / update / delete）を当該グループのメンバーに許可（categories / budgets と同方針。`created_by` 制約は無し）。

### Server Action（app/(dashboard)/dashboard/savings-goal-actions.ts）

- `upsertSavingsGoal(prevState, formData)`: `household_id` を競合キーに upsert（`onConflict: "household_id"`）。name / target_amount / start_date / target_date を zod でバリデーション（target_date 任意・start_date より後）。
- `deleteSavingsGoal(formData)`: `household_id` でスコープして削除（目標解除）。
- どちらも `getActiveHouseholdId()` でスコープ、`revalidatePath("/dashboard")`。

## テスト（TDD）

- `lib/savings-goal.test.ts`（純関数）: 進捗率・残額・達成・期日なし（pace null）・期日あり通常・期日超過・負の貯金（saved < 0）・達成超過（saved > target）の各ケース。
- 貯金目標カードのコンポーネントテスト（空状態／設定済み表示／ペース表示の有無）。

## 未解決の課題

- 開始日より前の取引は貯金額に含めない（過去の蓄積は対象外で、目標開始時点からの積み上げを測る）。
- 貯金額の集計は対象期間の取引行を取得して JS 集計する。長期間で行数が増えた場合の最適化（集計用 RPC/ビュー）は将来拡張。
- 達成・期日超過の通知（バナー/プッシュ）は初版では行わず、カード内の視覚表現のみ。
- 複数目標・目標履歴は将来拡張（初版はグループに1つ）。
