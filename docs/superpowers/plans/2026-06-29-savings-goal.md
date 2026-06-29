# 貯金目標 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 家計簿グループに1つの貯金目標を設定し、開始日以降の世帯収支差額から進捗を自動算出してダッシュボードに表示する。

**Architecture:** 予算機能(spec 30)と同じ構成を踏襲する。`savings_goals` テーブル（household_id UNIQUE）＋ 純関数 `lib/savings-goal.ts#buildSavingsProgress` で進捗を集計し、Server Action で upsert/削除、ダッシュボードにクライアントカードを統合する。進捗の元データ（開始日以降の収入・支出）はダッシュボード側で取得して JS 合算する。

**Tech Stack:** Next.js (App Router) / TypeScript / Supabase (PostgreSQL + RLS) / Vitest + React Testing Library / shadcn/ui (Dialog, Input, Button)

## Global Constraints

- household スコープ必須: `savings_goals`・`transactions` の取得は必ず `household_id` でスコープする。`household_id` は `lib/household.ts#getActiveHouseholdId()` 経由で取得。
- TDD: 実装前に失敗するテストを書く（Red → Green → Refactor）。
- 純関数の集計は JS 側で行いテストで検証する（DB 集計に頼らない）。
- 金額入力は四則演算式に対応（`lib/amount-expression.ts#evaluateAmount`）。
- コミットメッセージ形式: `<type>: <日本語の説明>`（feat/fix/test/docs/chore）。各コミット末尾に `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。
- 仕様: `docs/specs/32_savings_goal.md`。

---

### Task 1: DB マイグレーションと型定義

**Files:**
- Create: `supabase/migrations/0020_savings_goals.sql`
- Modify: `types/database.ts`（`Tables` に `savings_goals` を追加）

**Interfaces:**
- Produces: `savings_goals` テーブル（列: id, household_id(UNIQUE), name, target_amount, start_date, target_date(NULL可), created_at）。型 `Database["public"]["Tables"]["savings_goals"]`。

- [ ] **Step 1: マイグレーションファイルを作成**

`supabase/migrations/0020_savings_goals.sql`:

```sql
-- 貯金目標（Savings Goals）
--
-- 家計簿グループに 1 つの貯金目標を設定する（household_id を UNIQUE）。
-- 進捗（貯金額）は start_date 以降・今日までの世帯全体の (収入 − 支出) から
-- アプリ側で算出する。専用の積立記録は持たず transactions から導出する。
-- 目標はグループ単位で共有され、メンバー全員が設定・編集できる
-- （created_by スコープは持たず budgets / categories と同方針）。

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  target_amount integer not null check (target_amount >= 1),
  start_date date not null,
  target_date date,
  created_at timestamptz not null default now(),
  -- グループに 1 つ。upsert の競合キーに使う。
  unique (household_id)
);

create index savings_goals_household_idx on public.savings_goals (household_id);

-- RLS（budgets の方針を踏襲：メンバーなら全操作可）------------------------
alter table public.savings_goals enable row level security;

create policy savings_goals_select_member on public.savings_goals
  for select using (private.is_household_member(household_id));

create policy savings_goals_insert_member on public.savings_goals
  for insert with check (private.is_household_member(household_id));

create policy savings_goals_update_member on public.savings_goals
  for update using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));

create policy savings_goals_delete_member on public.savings_goals
  for delete using (private.is_household_member(household_id));
```

- [ ] **Step 2: マイグレーションをリモート Supabase に適用**

`mcp__supabase__apply_migration`（name: `savings_goals`、query: 上記 SQL）で適用する。
（CLI 環境なら `supabase db push`。）
Expected: エラーなく `savings_goals` テーブルが作成される。

- [ ] **Step 3: 型定義を追加**

`types/database.ts` の `public.Tables` 内（既存の `budgets:` ブロックの直後）に、同じインデントで以下を追加する:

```typescript
      savings_goals: {
        Row: {
          created_at: string
          household_id: string
          id: string
          name: string
          start_date: string
          target_amount: number
          target_date: string | null
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          name: string
          start_date: string
          target_amount: number
          target_date?: string | null
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          name?: string
          start_date?: string
          target_amount?: number
          target_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "savings_goals_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: true
            referencedRelation: "households"
            referencedColumns: ["id"]
          }
        ]
      }
```

- [ ] **Step 4: 型チェック**

Run: `npm run typecheck`
Expected: エラーなし（PASS）。

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0020_savings_goals.sql types/database.ts
git commit -m "$(cat <<'EOF'
feat: 貯金目標テーブル(savings_goals)を追加

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 進捗算出の純関数（lib/savings-goal.ts）

**Files:**
- Create: `lib/savings-goal.ts`
- Test: `lib/savings-goal.test.ts`

**Interfaces:**
- Produces:
  - `type SavingsGoalInput = { name: string; targetAmount: number; startDate: string; targetDate: string | null }`
  - `type SavingsPace = { monthsLeft: number; requiredPerMonth: number; overdue: boolean }`
  - `type SavingsProgress = { name: string; targetAmount: number; saved: number; pct: number; remaining: number; reached: boolean; pace: SavingsPace | null }`
  - `function buildSavingsProgress(goal: SavingsGoalInput, saved: number, today: Date): SavingsProgress`
  - 仕様: `pct = round(max(saved,0)/target*100)`（上限なし）、`remaining = max(target − saved, 0)`、`reached = saved >= target`。`pace` は `targetDate` が非 null かつ未達のときのみ。`monthsLeft = max(1, ceil(残日数/30))`、`requiredPerMonth = ceil(remaining/monthsLeft)`、`overdue = 残日数 <= 0`。日付は UTC の年月日で比較する。

- [ ] **Step 1: 失敗するテストを書く**

`lib/savings-goal.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { buildSavingsProgress } from "@/lib/savings-goal";

const base = {
  name: "旅行資金",
  targetAmount: 300_000,
  startDate: "2026-04-01",
  targetDate: null as string | null,
};
const today = new Date("2026-06-29T00:00:00Z");

describe("buildSavingsProgress", () => {
  it("期日なしは進捗率・残額を出しペースは null", () => {
    const r = buildSavingsProgress(base, 80_000, today);
    expect(r.saved).toBe(80_000);
    expect(r.pct).toBe(27); // round(80000/300000*100)=27
    expect(r.remaining).toBe(220_000);
    expect(r.reached).toBe(false);
    expect(r.pace).toBeNull();
  });

  it("達成済みは reached=true・remaining=0・pace=null", () => {
    const r = buildSavingsProgress(
      { ...base, targetDate: "2026-12-31" },
      300_000,
      today,
    );
    expect(r.reached).toBe(true);
    expect(r.remaining).toBe(0);
    expect(r.pace).toBeNull();
  });

  it("超過貯金でも pct は 100 を超える（頭打ちしない）", () => {
    const r = buildSavingsProgress(base, 360_000, today);
    expect(r.pct).toBe(120);
    expect(r.reached).toBe(true);
    expect(r.remaining).toBe(0);
  });

  it("負の貯金は進捗0%・残額は目標全額", () => {
    const r = buildSavingsProgress(base, -50_000, today);
    expect(r.pct).toBe(0);
    expect(r.remaining).toBe(300_000);
    expect(r.reached).toBe(false);
  });

  it("期日ありはペース（残り月数・月あたり必要額）を出す", () => {
    // 2026-06-29 → 2026-12-31 は 185 日。ceil(185/30)=7 ヶ月。
    const r = buildSavingsProgress(
      { ...base, targetDate: "2026-12-31" },
      80_000,
      today,
    );
    expect(r.pace).not.toBeNull();
    expect(r.pace?.overdue).toBe(false);
    expect(r.pace?.monthsLeft).toBe(7);
    // ceil(220000/7)=31429
    expect(r.pace?.requiredPerMonth).toBe(31_429);
  });

  it("期日超過かつ未達は overdue=true", () => {
    const r = buildSavingsProgress(
      { ...base, targetDate: "2026-06-01" },
      80_000,
      today,
    );
    expect(r.pace?.overdue).toBe(true);
    expect(r.remaining).toBe(220_000);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test:run -- lib/savings-goal.test.ts`
Expected: FAIL（`buildSavingsProgress` が存在しない / モジュール未解決）。

- [ ] **Step 3: 最小実装を書く**

`lib/savings-goal.ts`:

```typescript
/**
 * 貯金目標の進捗算出（純関数）。
 *
 * 進捗（貯金額 saved）= 開始日以降・今日までの世帯全体の (収入 − 支出)。
 * saved は呼び出し側で集計済みの値を受け取る。目標額・期日と突き合わせ、
 * 進捗率・残額・達成判定と、期日があるときのペース（残り月数・月あたり必要額）を求める。
 */

/** 目標の入力（DB 行をアプリ向けに写したもの）。 */
export type SavingsGoalInput = {
  name: string;
  targetAmount: number;
  /** YYYY-MM-DD。この日以降の収支差額を貯金とみなす。 */
  startDate: string;
  /** YYYY-MM-DD。任意の期日。null ならペース表示なし。 */
  targetDate: string | null;
};

/** 期日ありのときのペース情報。 */
export type SavingsPace = {
  /** 残り月数。max(1, ceil(残日数/30))。 */
  monthsLeft: number;
  /** 目標達成に必要な月あたり額。ceil(remaining/monthsLeft)。 */
  requiredPerMonth: number;
  /** 残日数 <= 0（期日超過）。 */
  overdue: boolean;
};

/** 進捗の算出結果。 */
export type SavingsProgress = {
  name: string;
  targetAmount: number;
  /** 開始日以降の (収入−支出)。負になりうる。 */
  saved: number;
  /** round(max(saved,0)/target*100)。上限なし（表示側で頭打ち）。 */
  pct: number;
  /** max(target − saved, 0)。 */
  remaining: number;
  /** saved >= target。 */
  reached: boolean;
  /** targetDate が非 null かつ未達のときのみ。それ以外は null。 */
  pace: SavingsPace | null;
};

const MS_PER_DAY = 86_400_000;

/** YYYY-MM-DD を UTC 0 時のミリ秒に変換する。 */
function dateMs(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getTime();
}

/** Date を UTC の年月日 0 時のミリ秒に正規化する。 */
function utcDayMs(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function buildSavingsProgress(
  goal: SavingsGoalInput,
  saved: number,
  today: Date,
): SavingsProgress {
  const target = goal.targetAmount;
  const reached = saved >= target;
  const positive = Math.max(saved, 0);
  const pct = target > 0 ? Math.round((positive / target) * 100) : 0;
  const remaining = Math.max(target - saved, 0);

  let pace: SavingsPace | null = null;
  if (goal.targetDate && !reached) {
    const days = Math.ceil((dateMs(goal.targetDate) - utcDayMs(today)) / MS_PER_DAY);
    const monthsLeft = Math.max(1, Math.ceil(days / 30));
    pace = {
      monthsLeft,
      requiredPerMonth: Math.ceil(remaining / monthsLeft),
      overdue: days <= 0,
    };
  }

  return { name: goal.name, targetAmount: target, saved, pct, remaining, reached, pace };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test:run -- lib/savings-goal.test.ts`
Expected: PASS（全 6 ケース）。

- [ ] **Step 5: Commit**

```bash
git add lib/savings-goal.ts lib/savings-goal.test.ts
git commit -m "$(cat <<'EOF'
feat: 貯金目標の進捗算出 buildSavingsProgress を追加

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: バリデーションスキーマ（lib/validations/savings-goal.ts）

**Files:**
- Create: `lib/validations/savings-goal.ts`
- Test: `lib/validations/savings-goal.test.ts`

**Interfaces:**
- Consumes: `lib/amount-expression.ts#evaluateAmount`
- Produces: `savingsGoalSchema`（zod）。フィールド: `name`(trim 後1文字以上), `target_amount`(式入力可・整数・1以上), `start_date`(YYYY-MM-DD), `target_date`(空文字/未入力は null、入力時は YYYY-MM-DD かつ `start_date` より後)。`type SavingsGoalInput = z.infer<typeof savingsGoalSchema>`。

- [ ] **Step 1: 失敗するテストを書く**

`lib/validations/savings-goal.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { savingsGoalSchema } from "@/lib/validations/savings-goal";

const ok = {
  name: "旅行資金",
  target_amount: "300000",
  start_date: "2026-04-01",
  target_date: "2026-12-31",
};

describe("savingsGoalSchema", () => {
  it("正しい入力を受理する", () => {
    const r = savingsGoalSchema.safeParse(ok);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.target_amount).toBe(300_000);
      expect(r.data.target_date).toBe("2026-12-31");
    }
  });

  it("目標額は四則演算式を評価する", () => {
    const r = savingsGoalSchema.safeParse({ ...ok, target_amount: "30000*10" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.target_amount).toBe(300_000);
  });

  it("期日は空文字なら null", () => {
    const r = savingsGoalSchema.safeParse({ ...ok, target_date: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.target_date).toBeNull();
  });

  it("名前が空なら拒否する", () => {
    expect(savingsGoalSchema.safeParse({ ...ok, name: "  " }).success).toBe(false);
  });

  it("目標額が0以下なら拒否する", () => {
    expect(savingsGoalSchema.safeParse({ ...ok, target_amount: "0" }).success).toBe(false);
  });

  it("期日が開始日以前なら拒否する", () => {
    expect(
      savingsGoalSchema.safeParse({ ...ok, target_date: "2026-04-01" }).success,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test:run -- lib/validations/savings-goal.test.ts`
Expected: FAIL（モジュール未解決）。

- [ ] **Step 3: 最小実装を書く**

`lib/validations/savings-goal.ts`:

```typescript
import { z } from "zod";

import { evaluateAmount } from "@/lib/amount-expression";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "日付の形式が不正です");

export const savingsGoalSchema = z
  .object({
    name: z
      .string()
      .transform((v) => v.trim())
      .pipe(z.string().min(1, "目標名を入力してください")),
    // 目標額は四則演算式を受け付ける（収支・予算の金額欄と同方針）。
    target_amount: z.preprocess(
      (v) => (typeof v === "string" ? evaluateAmount(v) : v),
      z
        .number({ message: "目標額を正しく入力してください" })
        .int("目標額は整数で入力してください")
        .min(1, "目標額は1円以上で入力してください"),
    ),
    start_date: isoDate,
    // 空文字・未入力は null（期日なし）。
    target_date: z.preprocess(
      (v) => (v === "" || v === undefined || v === null ? null : v),
      isoDate.nullable(),
    ),
  })
  .refine(
    (d) => d.target_date === null || d.target_date > d.start_date,
    { path: ["target_date"], message: "期日は開始日より後にしてください" },
  );

export type SavingsGoalInput = z.infer<typeof savingsGoalSchema>;
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test:run -- lib/validations/savings-goal.test.ts`
Expected: PASS（全 6 ケース）。

- [ ] **Step 5: Commit**

```bash
git add lib/validations/savings-goal.ts lib/validations/savings-goal.test.ts
git commit -m "$(cat <<'EOF'
feat: 貯金目標の入力バリデーションスキーマを追加

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Server Actions（設定/解除）

**Files:**
- Create: `app/(dashboard)/dashboard/savings-goal-actions.ts`

**Interfaces:**
- Consumes: `savingsGoalSchema`, `getActiveHouseholdId`, `createClient`
- Produces:
  - `type SavingsGoalActionState = { error: string } | { ok: true } | undefined`
  - `async function upsertSavingsGoal(_prev: SavingsGoalActionState, formData: FormData): Promise<SavingsGoalActionState>` — `household_id` を競合キーに upsert（`onConflict: "household_id"`）。成功時 `{ ok: true }`。
  - `async function deleteSavingsGoal(): Promise<void>` — `household_id` でスコープして削除。

> このタスクは Server Action（"use server"）でユニットテストが難しいため、TDD のテストステップは設けず、後続の Task 6（ダッシュボード結線後）の手動確認＋ `npm run typecheck` で検証する。

- [ ] **Step 1: Server Action を実装**

`app/(dashboard)/dashboard/savings-goal-actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getActiveHouseholdId } from "@/lib/household";
import { createClient } from "@/lib/supabase/server";
import { savingsGoalSchema } from "@/lib/validations/savings-goal";

export type SavingsGoalActionState = { error: string } | { ok: true } | undefined;

/** 貯金目標を設定（新規/更新）する。グループに1件で upsert する。 */
export async function upsertSavingsGoal(
  _prevState: SavingsGoalActionState,
  formData: FormData,
): Promise<SavingsGoalActionState> {
  const parsed = savingsGoalSchema.safeParse({
    name: formData.get("name"),
    target_amount: formData.get("target_amount"),
    start_date: formData.get("start_date"),
    target_date: formData.get("target_date"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const householdId = await getActiveHouseholdId();
  if (!householdId) {
    redirect("/households");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("savings_goals").upsert(
    {
      household_id: householdId,
      name: parsed.data.name,
      target_amount: parsed.data.target_amount,
      start_date: parsed.data.start_date,
      target_date: parsed.data.target_date,
    },
    { onConflict: "household_id" },
  );

  if (error) {
    return { error: "貯金目標の保存に失敗しました" };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}

/** 貯金目標を解除（削除）する。household_id でスコープする。 */
export async function deleteSavingsGoal(): Promise<void> {
  const householdId = await getActiveHouseholdId();
  if (!householdId) {
    redirect("/households");
  }

  const supabase = await createClient();
  await supabase.from("savings_goals").delete().eq("household_id", householdId);

  revalidatePath("/dashboard");
}
```

- [ ] **Step 2: 型チェック**

Run: `npm run typecheck`
Expected: エラーなし（PASS）。

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/dashboard/savings-goal-actions.ts"
git commit -m "$(cat <<'EOF'
feat: 貯金目標の設定/解除 Server Action を追加

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: 貯金目標カード（表示＋設定ダイアログ）

**Files:**
- Create: `components/features/dashboard/savings-goal-card.tsx`
- Test: `components/features/dashboard/savings-goal-card.test.tsx`

**Interfaces:**
- Consumes: `SavingsProgress`(lib/savings-goal), `upsertSavingsGoal`/`deleteSavingsGoal`/`SavingsGoalActionState`(savings-goal-actions), shadcn `Dialog`/`Input`/`Button`, `Surface`, `yen`(lib/format)
- Produces: `function SavingsGoalCard(props: { progress: SavingsProgress | null; goal: { start_date: string; target_date: string | null } | null }): JSX.Element`
  - `progress === null`（目標未設定）→ 空状態＋「目標を設定」ボタン（ダイアログを開く）
  - `progress` あり → 目標名・進捗バー・「貯金額 / 目標額」「N%」・残額/達成・ペース、編集/解除
  - フォーム送信成功（`state.ok`）でダイアログを閉じる

- [ ] **Step 1: 失敗するテストを書く**

`components/features/dashboard/savings-goal-card.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SavingsGoalCard } from "./savings-goal-card";

// Server Action はクライアントから import されるためモックする。
vi.mock("@/app/(dashboard)/dashboard/savings-goal-actions", () => ({
  upsertSavingsGoal: vi.fn(),
  deleteSavingsGoal: vi.fn(),
}));

describe("SavingsGoalCard", () => {
  it("目標未設定なら空状態と設定ボタンを出す", () => {
    render(<SavingsGoalCard progress={null} goal={null} />);
    expect(screen.getByText("目標を設定")).toBeInTheDocument();
  });

  it("目標ありなら名前・進捗率・残額を出す", () => {
    render(
      <SavingsGoalCard
        progress={{
          name: "旅行資金",
          targetAmount: 300_000,
          saved: 80_000,
          pct: 27,
          remaining: 220_000,
          reached: false,
          pace: null,
        }}
        goal={{ start_date: "2026-04-01", target_date: null }}
      />,
    );
    expect(screen.getByText("旅行資金")).toBeInTheDocument();
    expect(screen.getByText("27%")).toBeInTheDocument();
    expect(screen.getByText(/残り/)).toBeInTheDocument();
  });

  it("期日ありはペース（あとMヶ月・月◯円）を出す", () => {
    render(
      <SavingsGoalCard
        progress={{
          name: "旅行資金",
          targetAmount: 300_000,
          saved: 80_000,
          pct: 27,
          remaining: 220_000,
          reached: false,
          pace: { monthsLeft: 7, requiredPerMonth: 31_429, overdue: false },
        }}
        goal={{ start_date: "2026-04-01", target_date: "2026-12-31" }}
      />,
    );
    expect(screen.getByText(/あと7ヶ月/)).toBeInTheDocument();
  });

  it("達成済みは達成表示を出す", () => {
    render(
      <SavingsGoalCard
        progress={{
          name: "旅行資金",
          targetAmount: 300_000,
          saved: 300_000,
          pct: 100,
          remaining: 0,
          reached: true,
          pace: null,
        }}
        goal={{ start_date: "2026-04-01", target_date: null }}
      />,
    );
    expect(screen.getByText(/達成/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test:run -- components/features/dashboard/savings-goal-card.test.tsx`
Expected: FAIL（モジュール未解決）。

- [ ] **Step 3: カードを実装**

`components/features/dashboard/savings-goal-card.tsx`:

```typescript
"use client";

import { Target } from "lucide-react";
import { useEffect, useState } from "react";
import { useActionState } from "react";

import {
  deleteSavingsGoal,
  upsertSavingsGoal,
  type SavingsGoalActionState,
} from "@/app/(dashboard)/dashboard/savings-goal-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { yen } from "@/lib/format";
import type { SavingsProgress } from "@/lib/savings-goal";
import { cn } from "@/lib/utils";

type Props = {
  progress: SavingsProgress | null;
  goal: { start_date: string; target_date: string | null } | null;
};

/** 今日（YYYY-MM-DD）。フォームの開始日デフォルトに使う。 */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 進捗に応じたペース/残額の補助文言。 */
function paceNote(p: SavingsProgress): string {
  if (p.reached) return "達成 🎉";
  if (p.pace?.overdue) return `期日超過（あと${yen(p.remaining)}）`;
  if (p.pace) {
    return `期日まであと${p.pace.monthsLeft}ヶ月・月${yen(p.pace.requiredPerMonth)}ペース`;
  }
  return `残り ${yen(p.remaining)}`;
}

/** 設定/編集フォーム（ダイアログ本体）。 */
function GoalForm({
  progress,
  goal,
  onDone,
}: Props & { onDone: () => void }) {
  const [state, formAction, pending] = useActionState<
    SavingsGoalActionState,
    FormData
  >(upsertSavingsGoal, undefined);

  useEffect(() => {
    if (state && "ok" in state && state.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="goal-name">目標名</Label>
        <Input
          id="goal-name"
          name="name"
          autoComplete="off"
          defaultValue={progress?.name ?? ""}
          placeholder="例: 旅行資金"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="goal-amount">目標額</Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            ¥
          </span>
          <Input
            id="goal-amount"
            name="target_amount"
            inputMode="numeric"
            autoComplete="off"
            defaultValue={progress ? String(progress.targetAmount) : ""}
            placeholder="目標額"
            className="pl-7"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="goal-start">開始日</Label>
          <Input
            id="goal-start"
            name="start_date"
            type="date"
            defaultValue={goal?.start_date ?? todayIso()}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="goal-target">期日（任意）</Label>
          <Input
            id="goal-target"
            name="target_date"
            type="date"
            defaultValue={goal?.target_date ?? ""}
          />
        </div>
      </div>
      {state && "error" in state && (
        <p className="text-xs text-expense" role="alert">
          {state.error}
        </p>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          保存
        </Button>
      </DialogFooter>
    </form>
  );
}

/** 貯金目標の表示＋設定ダイアログ（client）。 */
export function SavingsGoalCard({ progress, goal }: Props) {
  const [open, setOpen] = useState(false);
  const pct = progress ? Math.min(100, Math.max(0, progress.pct)) : 0;

  return (
    <Card data-testid="savings-goal-card" className="shadow-soft">
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-income-soft text-income">
              <Target className="size-4" aria-hidden />
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              貯金目標
            </span>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant={progress ? "ghost" : "default"} size="sm">
                {progress ? "編集" : "目標を設定"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>貯金目標</DialogTitle>
                <DialogDescription>
                  開始日以降の収支差額を貯金として進捗を表示します。
                </DialogDescription>
              </DialogHeader>
              <GoalForm
                progress={progress}
                goal={goal}
                onDone={() => setOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        {progress ? (
          <>
            <p className="truncate font-heading text-base font-bold">
              {progress.name}
            </p>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
              <span>
                {yen(progress.saved)}{" "}
                <span className="opacity-60">/ {yen(progress.targetAmount)}</span>
              </span>
              <span
                className={cn("font-medium", progress.reached && "text-income")}
              >
                {progress.pct}%
              </span>
            </div>
            <div
              role="img"
              aria-label={`目標 ${yen(progress.targetAmount)} に対し ${yen(progress.saved)}（${progress.pct}%）`}
              className="h-2 w-full overflow-hidden rounded-full bg-secondary"
            >
              <div
                className="h-full bg-income transition-[width] duration-700 ease-out"
                style={{ width: `${pct}%` }}
                aria-hidden
              />
            </div>
            <p
              className={cn(
                "text-[11px] tabular-nums",
                progress.reached ? "font-medium text-income" : "text-muted-foreground",
              )}
            >
              {paceNote(progress)}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            貯金目標はまだありません。目標額を決めて、みんなで貯めましょう。
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

> 注: `components/ui/label.tsx` が無い場合は `npx shadcn@latest add label` で追加する（`components/ui/` は直接編集しない）。`dialog.tsx`・`input.tsx`・`button.tsx`・`card.tsx` は既存。

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test:run -- components/features/dashboard/savings-goal-card.test.tsx`
Expected: PASS（全 4 ケース）。

- [ ] **Step 5: Commit**

```bash
git add "components/features/dashboard/savings-goal-card.tsx" "components/features/dashboard/savings-goal-card.test.tsx" components/ui/label.tsx 2>/dev/null
git commit -m "$(cat <<'EOF'
feat: 貯金目標カード（表示＋設定ダイアログ）を追加

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: ダッシュボード結線（データ取得＋カード配置）

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `buildSavingsProgress`(lib/savings-goal), `SavingsGoalCard`(components/features/dashboard/savings-goal-card)
- Produces: ダッシュボードに貯金目標カードを表示。`savings_goals` から目標を取得し、目標があれば `start_date` 以降〜今日の世帯全体取引から `saved = Σ(income) − Σ(expense)` を集計して `buildSavingsProgress` に渡す。

- [ ] **Step 1: import を追加**

`app/(dashboard)/dashboard/page.tsx` の import 群に追加:

```typescript
import { SavingsGoalCard } from "@/components/features/dashboard/savings-goal-card";
import { buildSavingsProgress, type SavingsProgress } from "@/lib/savings-goal";
```

- [ ] **Step 2: 目標と貯金額の取得を追加**

`fetchBudgets` 関数定義の直後に、貯金目標と貯金額を取得するヘルパーを追加する:

```typescript
  // 貯金目標（グループに1件）と、開始日以降・今日までの世帯全体の収支差額を取得する。
  const fetchSavingsGoal = async (): Promise<{
    progress: SavingsProgress | null;
    goal: { start_date: string; target_date: string | null } | null;
  }> => {
    const { data: goal } = await supabase
      .from("savings_goals")
      .select("name, target_amount, start_date, target_date")
      .eq("household_id", householdId)
      .maybeSingle();
    if (!goal) return { progress: null, goal: null };

    const { data: savedRows } = await supabase
      .from("transactions")
      .select("amount, type")
      .eq("household_id", householdId)
      .gte("date", goal.start_date)
      .lte("date", toISODate(new Date()));
    const saved = (savedRows ?? []).reduce(
      (s, t) => s + (t.type === "income" ? t.amount : -t.amount),
      0,
    );

    return {
      progress: buildSavingsProgress(
        {
          name: goal.name,
          targetAmount: goal.target_amount,
          startDate: goal.start_date,
          targetDate: goal.target_date,
        },
        saved,
        new Date(),
      ),
      goal: { start_date: goal.start_date, target_date: goal.target_date },
    };
  };
```

- [ ] **Step 3: 並列取得に savingsGoal を追加**

既存の `Promise.all([...])` を以下のように変更する（`fetchSavingsGoal()` を追加）:

```typescript
  const [{ data }, { data: prevData }, members, budgets, savingsGoal] =
    await Promise.all([
      buildQuery(range.start, range.end).overrideTypes<TransactionRow[]>(),
      buildQuery(prevRange.start, prevRange.end).overrideTypes<TransactionRow[]>(),
      fetchMembers(),
      fetchBudgets(),
      fetchSavingsGoal(),
    ]);
```

- [ ] **Step 4: カードを JSX に配置**

`SummaryCards` を包む `<div>`（`animationDelay: "60ms"` のブロック）の直後に、新しいブロックを追加する:

```tsx
      <div className={reveal} style={{ animationDelay: "90ms" }}>
        <SavingsGoalCard
          progress={savingsGoal.progress}
          goal={savingsGoal.goal}
        />
      </div>
```

- [ ] **Step 5: 型チェックとテスト**

Run: `npm run typecheck && npm run test:run`
Expected: 型エラーなし、全テスト PASS。

- [ ] **Step 6: 手動確認（開発サーバー）**

Run: `npm run dev` でダッシュボードを開く。
Expected:
- 目標未設定: 「目標を設定」ボタン→ダイアログで名前/目標額/開始日/期日を入力し保存→カードに進捗バーが出る。
- 期日なしで保存→残額のみ表示。期日ありで保存→「あとMヶ月・月◯円ペース」表示。
- 「解除」相当（編集ダイアログから再設定 or 別途解除ボタン）。※解除ボタンは Task 5 のカードに未配置のため、必要なら下記フォローで追加。

- [ ] **Step 7: Commit**

```bash
git add "app/(dashboard)/dashboard/page.tsx"
git commit -m "$(cat <<'EOF'
feat: ダッシュボードに貯金目標カードを統合

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: 解除ボタンとヘルプ・仕様同期（仕上げ）

**Files:**
- Modify: `components/features/dashboard/savings-goal-card.tsx`（解除ボタン追加）
- Modify: `components/features/help/*`（ダッシュボードのヘルプに貯金目標を追記。該当ファイルは `grep` で特定）

**Interfaces:**
- Consumes: `deleteSavingsGoal`(savings-goal-actions)

- [ ] **Step 1: カードに解除ボタンを追加**

`savings-goal-card.tsx` のダイアログ `<DialogFooter>` 内、保存ボタンの隣に解除フォームを追加する（目標設定済みのときのみ）。`GoalForm` の引数に `hasGoal: boolean` を追加し、footer を次のようにする:

```tsx
      <DialogFooter className="gap-2 sm:justify-between">
        {hasGoal && (
          <form action={deleteSavingsGoal}>
            <Button type="submit" variant="ghost" onClick={onDone}>
              目標を解除
            </Button>
          </form>
        )}
        <Button type="submit" disabled={pending}>
          保存
        </Button>
      </DialogFooter>
```

`GoalForm` 呼び出し側で `hasGoal={progress !== null}` を渡し、`GoalForm` の型に `hasGoal: boolean` を追加する。

- [ ] **Step 2: 型チェックとテスト**

Run: `npm run typecheck && npm run test:run -- components/features/dashboard/savings-goal-card.test.tsx`
Expected: PASS。

- [ ] **Step 3: ヘルプに貯金目標の項目を追記**

Run: `grep -rl "ダッシュボード" components/features/help/`
特定したヘルプファイルのダッシュボード節に、貯金目標の説明（目標額・開始日以降の収支差額で進捗・期日でペース表示）を1項目追加する（既存項目と同じ書式に合わせる）。

- [ ] **Step 4: 仕様書のセッションログを作成**

`/project:new-session` 相当で `docs/sessions/2026-06-29_savings-goal.md` に本機能の実装ログを記録する。

- [ ] **Step 5: 最終確認**

Run: `npm run lint && npm run typecheck && npm run test:run`
Expected: すべて PASS。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: 貯金目標の解除ボタンとヘルプ・セッションログを追加

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- グループに1つ（household_id UNIQUE）→ Task 1 ✓
- 進捗=開始日以降の世帯収支差額 → Task 2（純関数）＋ Task 6（集計取得）✓
- 期日任意・ペース表示 → Task 2（pace）＋ Task 5（paceNote）✓
- 目標額の式入力 → Task 3（evaluateAmount）✓
- ダッシュボードのみ表示 → Task 5/6 ✓
- Server Action upsert/削除＋RLS → Task 1（RLS）＋ Task 4 ✓
- テスト（純関数の各ケース・カード表示）→ Task 2/3/5 ✓
- 解除・ヘルプ → Task 7 ✓

**Placeholder scan:** プレースホルダなし。各コード手順に実コードを記載。

**Type consistency:** `buildSavingsProgress` / `SavingsProgress` / `SavingsGoalActionState` のシグネチャは Task 2/4 の定義と Task 5/6 の利用で一致。`upsertSavingsGoal` は `{ ok: true }` を返し、カードの `useEffect` で `"ok" in state` を判定して整合。

**注意点:** `npm run dev` での手動確認はエージェント実行環境では人手が必要。Server Action のユニットテストは設けず typecheck＋手動確認で担保（Task 4 に明記）。
