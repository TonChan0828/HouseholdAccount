# メンバー間精算（割り勘） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 精算対象フラグ付きの支出を当期（締め日ベース）ごとに全メンバーで均等割りし、送金案を `/settlements` に表示。「精算済みにする」で期間を確定・記録する（spec: `docs/specs/37_member_settlement.md`）。

**Architecture:** `transactions.is_shared` フラグ + `settlements` 記録テーブル（スナップショット jsonb）。計算は `lib/settlement.ts` の純関数（`lib/budget.ts` と同パターン）。ページは Server Component + Server Actions（`/budgets` と相似形）。

**Tech Stack:** Next.js App Router / TypeScript / Supabase (PostgreSQL + RLS) / Tailwind + shadcn/ui / Vitest + RTL / Playwright

## Global Constraints

- **household スコープ必須**: `transactions`・`settlements` の取得・更新は必ず `household_id` でスコープする（CLAUDE.md 規約）
- **TDD**: 各タスクは Red → Green → Refactor。テストを先に書く
- **コミット形式**: `<type>: <日本語の説明>`（feat/fix/refactor/test/docs/chore）
- **UI 文言（仕様書から正確に）**: 「精算対象（割り勘）」「精算済みにする」「すでに精算済みです」「精算済み」「現在の記帳内容と差異があります」「この期間に精算対象の支出はありません」「精算の必要はありません」
- **完了条件**: `npm run test:e2e -- --workers=1` 全通過（Rule 5。CI 同条件）
- コメント・テスト記述は既存コードに合わせて日本語
- shadcn/ui（`components/ui/`）は直接編集しない

---

### Task 1: DB マイグレーション 0021 + 型定義

**Files:**
- Create: `supabase/migrations/0021_member_settlement.sql`
- Modify: `types/database.ts`（transactions / recurring_transactions / settlements）
- Modify: `types/index.ts`

**Interfaces:**
- Consumes: 既存スキーマ（0018 の `generate_due_recurring` を置き換え）
- Produces: `transactions.is_shared` / `recurring_transactions.is_shared` / `settlements` テーブル。TS 側は `Tables["settlements"]["Row"]` と `Settlement` 型

- [ ] **Step 1: マイグレーション SQL を作成**

`supabase/migrations/0021_member_settlement.sql`:

```sql
-- メンバー間精算（spec 37）
--
-- 支出に「精算対象（割り勘）」フラグを追加し、当期の対象支出を全メンバーで
-- 均等割りした結果を settlements に期間単位で記録する。
-- snapshot には精算時点の計算結果（SettlementResult + 表示名）を保存し、
-- 後から取引が編集されても記録が壊れないようにする。

alter table public.transactions
  add column is_shared boolean not null default false;

alter table public.recurring_transactions
  add column is_shared boolean not null default false;

-- 定期収支の自動生成に is_shared を引き継ぐ（0018 の定義を置き換え。
-- create or replace は既存の GRANT/REVOKE を維持するため権限の再設定は不要）。
create or replace function public.generate_due_recurring(_household_id uuid)
  returns integer
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_start_day   integer;
  v_month_start date;
  v_period_start date;
  v_inserted    integer;
begin
  -- 呼び出し者が当該グループのメンバーであることを確認する。
  if not private.is_household_member(_household_id) then
    return 0;
  end if;

  select period_start_day into v_start_day
  from public.households
  where id = _household_id;

  if v_start_day is null then
    return 0;
  end if;

  -- 当期の開始日を算出する（period_start_day は 1〜28 なので月末調整は不要）。
  v_month_start := date_trunc('month', current_date)::date;
  v_period_start := v_month_start + (v_start_day - 1);
  if current_date < v_period_start then
    v_period_start := (v_month_start - interval '1 month')::date + (v_start_day - 1);
  end if;

  with inserted as (
    insert into public.transactions
      (household_id, created_by, type, amount, category_id, date, memo, recurring_id, is_shared)
    select
      r.household_id, r.created_by, r.type, r.amount, r.category_id,
      v_period_start, r.memo, r.id, r.is_shared
    from public.recurring_transactions r
    where r.household_id = _household_id
      and r.is_active
    on conflict (recurring_id, date) where recurring_id is not null do nothing
    returning 1
  )
  select count(*) into v_inserted from inserted;

  return v_inserted;
end;
$$;

-- 精算記録テーブル ------------------------------------------------------------
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  period_start date not null,
  settled_by uuid not null references auth.users (id) on delete cascade,
  settled_at timestamptz not null default now(),
  snapshot jsonb not null,
  -- 同一期間の二重精算を DB レベルで防止する。
  unique (household_id, period_start)
);

create index settlements_household_idx on public.settlements (household_id);

-- RLS ------------------------------------------------------------------------
alter table public.settlements enable row level security;

create policy settlements_select_member on public.settlements
  for select using (private.is_household_member(household_id));

-- 精算の実行はメンバーなら誰でも可。ただし settled_by は本人に限定する。
create policy settlements_insert_member on public.settlements
  for insert with check (
    private.is_household_member(household_id)
    and (settled_by = (select auth.uid()))
  );

-- 取り消しは実行者本人のみ。
create policy settlements_delete_creator on public.settlements
  for delete using (
    private.is_household_member(household_id)
    and (settled_by = (select auth.uid()))
  );
-- UPDATE ポリシーは定義しない（更新は行わない）。
```

- [ ] **Step 2: マイグレーションを Supabase プロジェクトへ適用**

Supabase MCP の `apply_migration`（name: `member_settlement`、query: 上記 SQL 全文）で適用する。対象プロジェクトは `mcp__supabase__list_projects` で確認（東京リージョンの本プロジェクト）。適用後 `mcp__supabase__list_tables` で `settlements` の存在と `transactions.is_shared` 列を確認する。

- [ ] **Step 3: `types/database.ts` を更新**

- `transactions` の `Row` に `is_shared: boolean`、`Insert`/`Update` に `is_shared?: boolean` を追加（既存の `memo` の隣にアルファベット順で）
- `recurring_transactions` も同様に `Row: is_shared: boolean` / `Insert?`/`Update?` を追加
- `Tables` に `settlements` ブロックを追加（`savings_goals` の直後など既存順序に合わせる）:

```typescript
      settlements: {
        Row: {
          household_id: string
          id: string
          period_start: string
          settled_at: string
          settled_by: string
          snapshot: Json
        }
        Insert: {
          household_id: string
          id?: string
          period_start: string
          settled_at?: string
          settled_by: string
          snapshot: Json
        }
        Update: {
          household_id?: string
          id?: string
          period_start?: string
          settled_at?: string
          settled_by?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "settlements_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
```

- [ ] **Step 4: `types/index.ts` に型を追加**

```typescript
export type Settlement = Tables["settlements"]["Row"];
```

- [ ] **Step 5: 型チェック**

Run: `npm run typecheck`
Expected: PASS（エラー 0）

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0021_member_settlement.sql types/database.ts types/index.ts
git commit -m "feat: メンバー間精算のDBスキーマを追加"
```

---

### Task 2: 精算計算の純関数 `lib/settlement.ts`（TDD）

**Files:**
- Create: `lib/settlement.ts`
- Test: `lib/settlement.test.ts`

**Interfaces:**
- Consumes: `MemberInfo`（`lib/members.ts`: `{ user_id: string; display_name: string }`）
- Produces:

```typescript
export type SettlementTx = {
  amount: number;
  type: "income" | "expense";
  created_by: string;
  is_shared: boolean;
};
export type SettlementMemberRow = {
  userId: string;
  displayName: string;
  paid: number;    // 当期の精算対象支出の立替合計
  balance: number; // paid − 1人あたり負担額（整数円・全員の合計は 0）
};
export type SettlementTransfer = {
  fromUserId: string;
  toUserId: string;
  amount: number; // 整数円・1 以上
};
export type SettlementResult = {
  total: number;
  perMember: number; // 表示用（Math.round(total / N)）
  rows: SettlementMemberRow[];      // members の並び順（joined_at 昇順）を維持
  transfers: SettlementTransfer[];  // 最大 members.length − 1 件
};
export function buildSettlement(txs: SettlementTx[], members: MemberInfo[]): SettlementResult;
export function settlementsEqual(a: SettlementResult, b: SettlementResult): boolean;
```

- [ ] **Step 1: 失敗するテストを書く**

`lib/settlement.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { buildSettlement, settlementsEqual } from "./settlement";

const members = [
  { user_id: "u-1", display_name: "太郎" },
  { user_id: "u-2", display_name: "花子" },
];

const tx = (
  amount: number,
  created_by: string,
  overrides: Partial<{ type: "income" | "expense"; is_shared: boolean }> = {},
) => ({
  amount,
  created_by,
  type: overrides.type ?? ("expense" as const),
  is_shared: overrides.is_shared ?? true,
});

describe("buildSettlement", () => {
  it("2人の立替を均等割りし、差額と送金案を返す", () => {
    const result = buildSettlement([tx(3000, "u-1"), tx(1000, "u-2")], members);

    expect(result.total).toBe(4000);
    expect(result.perMember).toBe(2000);
    expect(result.rows).toEqual([
      { userId: "u-1", displayName: "太郎", paid: 3000, balance: 1000 },
      { userId: "u-2", displayName: "花子", paid: 1000, balance: -1000 },
    ]);
    expect(result.transfers).toEqual([
      { fromUserId: "u-2", toUserId: "u-1", amount: 1000 },
    ]);
  });

  it("is_shared=false・income・脱退者(非メンバー)の取引は対象外", () => {
    const result = buildSettlement(
      [
        tx(3000, "u-1"),
        tx(9999, "u-1", { is_shared: false }),
        tx(5000, "u-1", { type: "income" }),
        tx(7777, "u-gone"), // メンバー一覧にいない登録者
      ],
      members,
    );

    expect(result.total).toBe(3000);
  });

  it("対象取引が0件なら全員 0 円・送金なし", () => {
    const result = buildSettlement([], members);

    expect(result.total).toBe(0);
    expect(result.rows.every((r) => r.paid === 0 && r.balance === 0)).toBe(true);
    expect(result.transfers).toEqual([]);
  });

  it("端数は最大剰余法で丸め、balance の合計は必ず 0 になる", () => {
    const three = [
      ...members,
      { user_id: "u-3", display_name: "次郎" },
    ];
    // 100 ÷ 3 = 33.33…。u-1 が全額立替 → u-1: +66 or +67, 他: -33/-34
    const result = buildSettlement([tx(100, "u-1")], three);

    const sum = result.rows.reduce((s, r) => s + r.balance, 0);
    expect(sum).toBe(0);
    expect(result.rows.every((r) => Number.isInteger(r.balance))).toBe(true);
    // 送金合計 = 債権者の受取額合計
    const transferSum = result.transfers.reduce((s, t) => s + t.amount, 0);
    expect(transferSum).toBe(result.rows[0].balance);
  });

  it("送金案は最大 N-1 件に収まる（3人で全員不均等）", () => {
    const three = [
      ...members,
      { user_id: "u-3", display_name: "次郎" },
    ];
    const result = buildSettlement(
      [tx(6000, "u-1"), tx(3000, "u-2")], // 合計9000 / 3人 = 3000
      three,
    );

    // u-1: +3000, u-2: 0, u-3: -3000 → 送金1件
    expect(result.transfers).toEqual([
      { fromUserId: "u-3", toUserId: "u-1", amount: 3000 },
    ]);
    expect(result.transfers.length).toBeLessThanOrEqual(three.length - 1);
  });

  it("メンバーが1人なら送金なし", () => {
    const result = buildSettlement([tx(3000, "u-1")], [members[0]]);

    expect(result.transfers).toEqual([]);
    expect(result.rows[0].balance).toBe(0); // 3000 - 3000/1
  });
});

describe("settlementsEqual", () => {
  const base = () => buildSettlement([tx(3000, "u-1"), tx(1000, "u-2")], members);

  it("同じ計算結果なら true", () => {
    expect(settlementsEqual(base(), base())).toBe(true);
  });

  it("displayName の違いは差異とみなさない", () => {
    const renamed = buildSettlement(
      [tx(3000, "u-1"), tx(1000, "u-2")],
      [
        { user_id: "u-1", display_name: "改名太郎" },
        { user_id: "u-2", display_name: "花子" },
      ],
    );
    expect(settlementsEqual(base(), renamed)).toBe(true);
  });

  it("金額が変わると false", () => {
    const changed = buildSettlement([tx(3500, "u-1"), tx(1000, "u-2")], members);
    expect(settlementsEqual(base(), changed)).toBe(false);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run lib/settlement.test.ts`
Expected: FAIL（`lib/settlement.ts` が存在しない）

- [ ] **Step 3: 実装**

`lib/settlement.ts`:

```typescript
import type { MemberInfo } from "@/lib/members";

/** 精算計算に使う取引の最小形（fetchTransactionsInRange の行と構造互換）。 */
export type SettlementTx = {
  amount: number;
  type: "income" | "expense";
  created_by: string;
  is_shared: boolean;
};

export type SettlementMemberRow = {
  userId: string;
  displayName: string;
  paid: number;
  balance: number;
};

export type SettlementTransfer = {
  fromUserId: string;
  toUserId: string;
  amount: number;
};

export type SettlementResult = {
  total: number;
  perMember: number;
  rows: SettlementMemberRow[];
  transfers: SettlementTransfer[];
};

/**
 * 当期の精算対象支出を全メンバーで均等割りする（spec 37）。
 *
 * - 対象は `is_shared = true` かつ `type = "expense"`、登録者が現メンバーの取引のみ
 *   （脱退者の取引は対象外。spec 07 と同じ扱い）
 * - balance は最大剰余法で整数円に丸め、全員の合計が必ず 0 になることを保証する
 * - 送金案は greedy（最大の債務者 → 最大の債権者）で最大 N−1 件に圧縮する
 */
export function buildSettlement(
  txs: SettlementTx[],
  members: MemberInfo[],
): SettlementResult {
  const paidBy = new Map(members.map((m) => [m.user_id, 0]));
  for (const t of txs) {
    if (t.type !== "expense" || !t.is_shared) continue;
    if (!paidBy.has(t.created_by)) continue;
    paidBy.set(t.created_by, (paidBy.get(t.created_by) ?? 0) + t.amount);
  }

  const total = [...paidBy.values()].reduce((s, v) => s + v, 0);
  const n = members.length;
  const share = n > 0 ? total / n : 0;

  // 実数の balance を最大剰余法で整数化する。floor の合計と 0 の差分を
  // 小数部の大きい順に +1 して埋める（同値はメンバー並び順で安定）。
  const raw = members.map((m) => (paidBy.get(m.user_id) ?? 0) - share);
  const balances = raw.map(Math.floor);
  let deficit = 0 - balances.reduce((s, v) => s + v, 0);
  const byFraction = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of byFraction) {
    if (deficit <= 0) break;
    balances[i] += 1;
    deficit -= 1;
  }

  const rows = members.map((m, i) => ({
    userId: m.user_id,
    displayName: m.display_name,
    paid: paidBy.get(m.user_id) ?? 0,
    balance: balances[i],
  }));

  return {
    total,
    perMember: n > 0 ? Math.round(share) : 0,
    rows,
    transfers: buildTransfers(rows),
  };
}

/** 債務者から債権者への送金案を greedy に組む（残額の大きい者同士から消し込む）。 */
function buildTransfers(rows: SettlementMemberRow[]): SettlementTransfer[] {
  const creditors = rows
    .filter((r) => r.balance > 0)
    .map((r) => ({ id: r.userId, rest: r.balance }))
    .sort((a, b) => b.rest - a.rest);
  const debtors = rows
    .filter((r) => r.balance < 0)
    .map((r) => ({ id: r.userId, rest: -r.balance }))
    .sort((a, b) => b.rest - a.rest);

  const transfers: SettlementTransfer[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const amount = Math.min(creditors[ci].rest, debtors[di].rest);
    if (amount > 0) {
      transfers.push({
        fromUserId: debtors[di].id,
        toUserId: creditors[ci].id,
        amount,
      });
    }
    creditors[ci].rest -= amount;
    debtors[di].rest -= amount;
    if (creditors[ci].rest === 0) ci += 1;
    if (debtors[di].rest === 0) di += 1;
  }
  return transfers;
}

/**
 * 精算スナップショットと再計算結果の差異判定（spec 37）。
 * 表示名の変更は差異とみなさないため displayName を除いて比較する。
 */
export function settlementsEqual(
  a: SettlementResult,
  b: SettlementResult,
): boolean {
  const strip = (r: SettlementResult) => ({
    total: r.total,
    perMember: r.perMember,
    rows: r.rows.map(({ userId, paid, balance }) => ({ userId, paid, balance })),
    transfers: r.transfers,
  });
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run lib/settlement.test.ts`
Expected: PASS（全ケース）

- [ ] **Step 5: Commit**

```bash
git add lib/settlement.ts lib/settlement.test.ts
git commit -m "feat: 精算計算の純関数を追加"
```

---

### Task 3: バリデーションに `is_shared` を追加（TDD）

**Files:**
- Modify: `lib/validations/transaction.ts`
- Test: `lib/validations/transaction.test.ts`（既存に追記）

**Interfaces:**
- Produces: `transactionSchema` / `recurringTransactionSchema` の出力に `is_shared: boolean` が加わる（`recurringTransactionSchema` は `transactionSchema` からの派生で自動的に含まれる）

- [ ] **Step 1: 失敗するテストを追記**

`lib/validations/transaction.test.ts` の `transactionSchema` describe に追記（既存テストのベース入力ヘルパーがあればそれを使う。無ければ以下の形で最小入力を組む）:

```typescript
describe("is_shared（精算対象フラグ）", () => {
  const base = {
    type: "expense",
    amount: "1000",
    date: "2026-07-04",
    category_id: "",
    memo: "",
  };

  it("チェックボックスの 'on' / 'true' は true になる", () => {
    expect(
      transactionSchema.parse({ ...base, is_shared: "on" }).is_shared,
    ).toBe(true);
    expect(
      transactionSchema.parse({ ...base, is_shared: "true" }).is_shared,
    ).toBe(true);
  });

  it("未指定（null）・'false' は false になる", () => {
    expect(
      transactionSchema.parse({ ...base, is_shared: null }).is_shared,
    ).toBe(false);
    expect(
      transactionSchema.parse({ ...base, is_shared: "false" }).is_shared,
    ).toBe(false);
  });

  it("recurringTransactionSchema にも引き継がれる", () => {
    const parsed = recurringTransactionSchema.parse({
      type: "expense",
      amount: "1000",
      category_id: "",
      memo: "",
      is_active: "true",
      is_shared: "on",
    });
    expect(parsed.is_shared).toBe(true);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run lib/validations/transaction.test.ts`
Expected: FAIL（スキーマに `is_shared` が無いため parse 結果が undefined になり、`toBe(true/false)` が落ちる）

- [ ] **Step 3: スキーマに追加**

`lib/validations/transaction.ts` の `transactionSchema` に追加:

```typescript
  // 精算対象（割り勘）。チェックボックス由来（"on"/"true"/未指定）を boolean に
  // 正規化する。未指定・その他の値は false（既定で対象外）。
  is_shared: z.preprocess(
    (v) => v === true || v === "true" || v === "on" || v === "1",
    z.boolean(),
  ),
```

`recurringTransactionSchema` は `transactionSchema.omit({ date: true }).extend(...)` のため変更不要。

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run lib/validations/transaction.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/validations/transaction.ts lib/validations/transaction.test.ts
git commit -m "feat: 収支バリデーションに精算対象フラグを追加"
```

---

### Task 4: 収支の登録・編集・一覧に `is_shared` を通す

**Files:**
- Modify: `app/(dashboard)/transactions/actions.ts`（parse・insert・update）
- Modify: `components/features/transactions/transaction-form.tsx`（チェックボックス）
- Test: `components/features/transactions/transaction-form.test.tsx`（既存に追記）
- Modify: `lib/queries/transactions.ts`（select + `TransactionRow`）
- Test: `lib/queries/transactions.test.ts`（フィクスチャに `is_shared` 追加）
- Modify: `app/(dashboard)/transactions/page.tsx`（「精算」バッジ）
- Modify: `app/(dashboard)/transactions/[id]/edit/page.tsx`（defaultValues）
- Test: `app/(dashboard)/transactions/actions.test.ts`（既存に追記）

**Interfaces:**
- Consumes: Task 3 の `transactionSchema`（`parsed.data.is_shared: boolean`）
- Produces: `TransactionRow` に `is_shared: boolean` が加わる（Task 6/7 が使用）。フォームは `defaultValues.is_shared?: boolean` を受け付け、`name="is_shared" value="true"` のチェックボックスを支出時のみ送信する

- [ ] **Step 1: フォームの失敗するテストを追記**

`components/features/transactions/transaction-form.test.tsx` に追記（既存のレンダリングヘルパー・カテゴリフィクスチャに合わせる）:

```tsx
describe("精算対象（割り勘）チェックボックス", () => {
  it("支出のとき表示され、既定は未チェック", () => {
    render(
      <TransactionForm action={noopAction} categories={categories} submitLabel="登録する" />,
    );
    const checkbox = screen.getByRole("checkbox", { name: /精算対象（割り勘）/ });
    expect(checkbox).not.toBeChecked();
  });

  it("収入に切り替えると表示されない", async () => {
    render(
      <TransactionForm action={noopAction} categories={categories} submitLabel="登録する" />,
    );
    await userEvent.click(screen.getByRole("radio", { name: "収入" }));
    expect(
      screen.queryByRole("checkbox", { name: /精算対象（割り勘）/ }),
    ).not.toBeInTheDocument();
  });

  it("defaultValues.is_shared=true でチェック済みになる", () => {
    render(
      <TransactionForm
        action={noopAction}
        categories={categories}
        submitLabel="更新する"
        defaultValues={{ type: "expense", is_shared: true }}
      />,
    );
    expect(
      screen.getByRole("checkbox", { name: /精算対象（割り勘）/ }),
    ).toBeChecked();
  });
});
```

（`noopAction`・`categories` は既存テストの定義を再利用。無ければ既存テスト冒頭の書き方に合わせて定義する）

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run components/features/transactions/transaction-form.test.tsx`
Expected: FAIL（checkbox が見つからない）

- [ ] **Step 3: フォームにチェックボックスを実装**

`components/features/transactions/transaction-form.tsx`:

1. `Props.defaultValues` に `is_shared?: boolean` を追加
2. state を追加: `const [isShared, setIsShared] = useState<boolean>(defaultValues?.is_shared ?? false);`
3. 「登録して続ける」成功時のリセット effect に `setIsShared(false);` を追加
4. メモ欄の下・「他のグループにも反映」の上に、支出時のみ表示するチェックボックスを追加（recurring-form の `is_active` トグルと同じ見た目）:

```tsx
      {type === "expense" ? (
        <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
          <span className="space-y-0.5">
            <span className="block text-sm font-medium">精算対象（割り勘）</span>
            <span className="block text-xs text-muted-foreground">
              メンバー間精算の均等割りに含めます
            </span>
          </span>
          <input
            type="checkbox"
            name="is_shared"
            value="true"
            checked={isShared}
            onChange={(e) => setIsShared(e.target.checked)}
            className="size-5 accent-primary"
          />
        </label>
      ) : null}
```

収入時はフィールド自体を描画しない（未送信 → バリデーションで false）。

- [ ] **Step 4: フォームテストが通ることを確認**

Run: `npx vitest run components/features/transactions/transaction-form.test.tsx`
Expected: PASS

- [ ] **Step 5: Server Action の失敗するテストを追記**

`app/(dashboard)/transactions/actions.test.ts` に追記（既存のモック・FormData ヘルパーに合わせる）:

```typescript
it("is_shared がチェックされていれば true で登録する", async () => {
  const formData = transactionFormData({ is_shared: "true" });
  await expect(createTransaction(undefined, formData)).rejects.toThrow(
    "NEXT_REDIRECT",
  );
  const insert = state.calls.find((c) => c.method === "insert");
  expect(insert?.values).toMatchObject({ is_shared: true });
});

it("is_shared 未指定は false で登録する", async () => {
  await expect(
    createTransaction(undefined, transactionFormData()),
  ).rejects.toThrow("NEXT_REDIRECT");
  const insert = state.calls.find((c) => c.method === "insert");
  expect(insert?.values).toMatchObject({ is_shared: false });
});
```

- [ ] **Step 6: actions を実装**

`app/(dashboard)/transactions/actions.ts`:

1. `parse()` に `is_shared: formData.get("is_shared"),` を追加
2. `createTransaction` の insert 値・`updateTransaction` の update 値に `is_shared: parsed.data.is_shared,` を追加（分割代入 `const { type, amount, date, category_id, memo, is_shared } = parsed.data;` に加える）
3. `mirrorTransaction` は変更しない。`MirrorRow` に `is_shared` を持たせず DB 既定値 false で挿入されることをコメントで明記:

```typescript
// 反映先は is_shared を引き継がない（反映先グループはメンバー構成が異なるため。spec 37）。
// MirrorRow に is_shared が無いので DB 既定値 false で挿入される。
```

- [ ] **Step 7: 一覧クエリと表示を更新**

1. `lib/queries/transactions.ts`: `TransactionRow` に `is_shared: boolean;` を追加し、select 文字列を `"id, amount, type, date, memo, created_by, category_id, recurring_id, is_shared, category:categories(name, color)"` に変更。`lib/queries/transactions.test.ts` のフィクスチャ行に `is_shared: false` を追加してグリーンを維持する
2. `app/(dashboard)/transactions/page.tsx`: 行の `<CategoryBadge />` と「他のメンバー」バッジの並びに追加:

```tsx
                                  {t.is_shared ? (
                                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                                      精算
                                    </span>
                                  ) : null}
```

3. `app/(dashboard)/transactions/[id]/edit/page.tsx`: `defaultValues` に `is_shared: transaction.is_shared,` を追加（select は `*` のため取得済み）

- [ ] **Step 8: デモモードへの影響を確認**

Run: `grep -rn "TransactionForm" app/demo components/features/demo`
Expected: ヒットなし（デモは独自実装）。ヒットした場合はデモ側のフォーム送信が `is_shared` を無視して壊れないことだけ確認する（デモ対応はスコープ外）。

- [ ] **Step 9: 全 Unit テスト + 型チェック**

Run: `npm run test:run && npm run typecheck`
Expected: PASS（既存テスト含め全通過）

- [ ] **Step 10: Commit**

```bash
git add app/(dashboard)/transactions components/features/transactions/transaction-form.tsx components/features/transactions/transaction-form.test.tsx lib/queries/transactions.ts lib/queries/transactions.test.ts
git commit -m "feat: 収支の登録・編集・一覧に精算対象フラグを追加"
```

---

### Task 5: 定期収支に `is_shared` を通す

**Files:**
- Modify: `app/(dashboard)/transactions/recurring/actions.ts`
- Test: `app/(dashboard)/transactions/recurring/actions.test.ts`（既存に追記）
- Modify: `components/features/transactions/recurring-form.tsx`
- Test: `components/features/transactions/recurring-form.test.tsx`（既存に追記）
- Modify: `app/(dashboard)/transactions/recurring/[id]/edit/page.tsx`（defaultValues に `is_shared` を渡す。new ページはフォーム既定値のみで変更不要か確認）

**Interfaces:**
- Consumes: Task 3 の `recurringTransactionSchema`、Task 1 の `recurring_transactions.is_shared` 列と `generate_due_recurring`（引き継ぎは DB 側で完了済み）
- Produces: 定期項目の作成・編集で `is_shared` が保存される

- [ ] **Step 1: 失敗するテストを追記**

`recurring/actions.test.ts` に Task 4 Step 5 と同形のテストを追記（`createRecurring` の insert 値に `is_shared: true / false` を確認）。
`recurring-form.test.tsx` に Task 4 Step 1 と同形のテスト（支出時のみ表示・default 反映）を追記。

Run: `npx vitest run app/\(dashboard\)/transactions/recurring/actions.test.ts components/features/transactions/recurring-form.test.tsx`
Expected: FAIL

- [ ] **Step 2: 実装**

1. `recurring/actions.ts`: `parse()` に `is_shared: formData.get("is_shared"),` を追加し、`createRecurring` の insert・`updateRecurring` の update に `is_shared` を追加
2. `recurring-form.tsx`: `Props.defaultValues` に `is_shared?: boolean` を追加し、`isShared` state + 支出時のみ表示のチェックボックスを Task 4 Step 3 と同じマークアップで「自動生成を有効にする」トグルの直前に追加:

```tsx
      {type === "expense" ? (
        <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
          <span className="space-y-0.5">
            <span className="block text-sm font-medium">精算対象（割り勘）</span>
            <span className="block text-xs text-muted-foreground">
              自動登録される収支をメンバー間精算の均等割りに含めます
            </span>
          </span>
          <input
            type="checkbox"
            name="is_shared"
            value="true"
            checked={isShared}
            onChange={(e) => setIsShared(e.target.checked)}
            className="size-5 accent-primary"
          />
        </label>
      ) : null}
```

3. `recurring/[id]/edit/page.tsx`: フォームの `defaultValues` に `is_shared: recurring.is_shared,`（変数名は既存に合わせる）を追加

- [ ] **Step 3: テストが通ることを確認**

Run: `npm run test:run`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/(dashboard)/transactions/recurring components/features/transactions/recurring-form.tsx components/features/transactions/recurring-form.test.tsx
git commit -m "feat: 定期収支に精算対象フラグを追加"
```

---

### Task 6: 精算の Server Actions（TDD）

**Files:**
- Create: `app/(dashboard)/settlements/actions.ts`
- Test: `app/(dashboard)/settlements/actions.test.ts`

**Interfaces:**
- Consumes: `buildSettlement`（Task 2）、`fetchTransactionsInRange`（Task 4 で `is_shared` 入り）、`getHouseholdMemberNames`、`requireDashboardContext`・`getHouseholdSettings`（`lib/household.ts`）、`getPeriodRange`・`refFromParam`・`toISODate`（`lib/period.ts`）
- Produces:

```typescript
export type SettlementActionState = { error: string } | undefined;
export async function createSettlement(
  _prevState: SettlementActionState,
  formData: FormData, // name="ref" に期間内の日付（YYYY-MM-DD）
): Promise<SettlementActionState>;
export async function deleteSettlement(formData: FormData): Promise<void>; // name="id"
```

- [ ] **Step 1: 失敗するテストを書く**

`app/(dashboard)/settlements/actions.test.ts`。モックは `app/(dashboard)/budgets/actions.test.ts` の `vi.hoisted` + `vi.mock` パターンを踏襲し、さらに次をモックする:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSettlement, deleteSettlement } from "./actions";

const state = vi.hoisted(() => ({
  householdId: null as string | null,
  members: [] as { user_id: string; display_name: string }[],
  txs: [] as unknown[],
  insertError: null as { code?: string; message: string } | null,
  calls: [] as { table: string; method: string; values?: unknown; filters: Record<string, string> }[],
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/household", () => ({
  requireDashboardContext: async () => {
    if (!state.householdId) throw new Error("NEXT_REDIRECT:/households");
    const { createClient } = await import("@/lib/supabase/server");
    return {
      user: { id: "u-1" },
      householdId: state.householdId,
      supabase: await createClient(),
    };
  },
  getHouseholdSettings: async () => ({ periodStartDay: 1 }),
}));

vi.mock("@/lib/queries/members", () => ({
  getHouseholdMemberNames: async () => state.members,
}));

vi.mock("@/lib/queries/transactions", () => ({
  fetchTransactionsInRange: async () => state.txs,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const call = { table, method: "", filters: {} as Record<string, string> };
      state.calls.push(call);
      const query = {
        insert(values: unknown) {
          call.method = "insert";
          call.values = values;
          return Promise.resolve({ error: state.insertError });
        },
        delete() {
          call.method = "delete";
          return query;
        },
        eq(column: string, value: string) {
          call.filters[column] = value;
          return query;
        },
        then(onFulfilled: (v: unknown) => unknown, onRejected?: (r: unknown) => unknown) {
          return Promise.resolve({ error: null }).then(onFulfilled, onRejected);
        },
      };
      return query;
    },
  }),
}));

function settleFormData(ref = "2026-07-01") {
  const formData = new FormData();
  formData.set("ref", ref);
  return formData;
}

beforeEach(() => {
  state.householdId = "h-1";
  state.members = [
    { user_id: "u-1", display_name: "太郎" },
    { user_id: "u-2", display_name: "花子" },
  ];
  state.txs = [
    { amount: 3000, type: "expense", created_by: "u-1", is_shared: true },
    { amount: 1000, type: "expense", created_by: "u-2", is_shared: true },
  ];
  state.insertError = null;
  state.calls = [];
});

describe("createSettlement", () => {
  it("再計算した snapshot を household・period_start・settled_by とともに insert する", async () => {
    const result = await createSettlement(undefined, settleFormData());

    expect(result).toBeUndefined();
    const insert = state.calls.find((c) => c.method === "insert");
    expect(insert?.table).toBe("settlements");
    expect(insert?.values).toMatchObject({
      household_id: "h-1",
      period_start: "2026-07-01",
      settled_by: "u-1",
    });
    const snapshot = (insert?.values as { snapshot: { total: number } }).snapshot;
    expect(snapshot.total).toBe(4000);
  });

  it("unique 違反（23505）は「すでに精算済みです」を返す", async () => {
    state.insertError = { code: "23505", message: "duplicate" };
    const result = await createSettlement(undefined, settleFormData());
    expect(result?.error).toBe("すでに精算済みです");
  });

  it("メンバーが1人ならエラーを返し insert しない", async () => {
    state.members = [{ user_id: "u-1", display_name: "太郎" }];
    const result = await createSettlement(undefined, settleFormData());
    expect(result?.error).toBeTruthy();
    expect(state.calls.find((c) => c.method === "insert")).toBeUndefined();
  });

  it("精算対象の支出が0件ならエラーを返し insert しない", async () => {
    state.txs = [];
    const result = await createSettlement(undefined, settleFormData());
    expect(result?.error).toBe("この期間に精算対象の支出はありません");
    expect(state.calls.find((c) => c.method === "insert")).toBeUndefined();
  });
});

describe("deleteSettlement", () => {
  it("id と household_id でスコープして削除する", async () => {
    const formData = new FormData();
    formData.set("id", "s-1");
    await deleteSettlement(formData);

    const del = state.calls.find((c) => c.method === "delete");
    expect(del?.table).toBe("settlements");
    expect(del?.filters).toEqual({ id: "s-1", household_id: "h-1" });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run app/\(dashboard\)/settlements/actions.test.ts`
Expected: FAIL（actions.ts が存在しない）

- [ ] **Step 3: 実装**

`app/(dashboard)/settlements/actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";

import {
  getHouseholdSettings,
  requireDashboardContext,
} from "@/lib/household";
import { getPeriodRange, refFromParam, toISODate } from "@/lib/period";
import { getHouseholdMemberNames } from "@/lib/queries/members";
import { fetchTransactionsInRange } from "@/lib/queries/transactions";
import { buildSettlement } from "@/lib/settlement";
import type { Json } from "@/types/database";

export type SettlementActionState = { error: string } | undefined;

/**
 * 当期を精算済みにする。実行時点の計算結果をスナップショットとして保存する。
 * 同一期間の二重精算は settlements の unique 制約（23505）で防ぐ。
 */
export async function createSettlement(
  _prevState: SettlementActionState,
  formData: FormData,
): Promise<SettlementActionState> {
  const ref = String(formData.get("ref") ?? "");

  const { user, householdId, supabase } = await requireDashboardContext();
  const { periodStartDay } = await getHouseholdSettings(householdId);
  const range = getPeriodRange(refFromParam(ref || undefined), periodStartDay);

  const [txs, members] = await Promise.all([
    fetchTransactionsInRange(supabase, householdId, range),
    getHouseholdMemberNames(householdId),
  ]);

  if (members.length < 2) {
    return { error: "精算にはメンバーが2人以上必要です" };
  }

  const result = buildSettlement(txs, members);
  if (result.total === 0) {
    return { error: "この期間に精算対象の支出はありません" };
  }

  const { error } = await supabase.from("settlements").insert({
    household_id: householdId,
    period_start: toISODate(range.start),
    settled_by: user.id,
    snapshot: result as unknown as Json,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "すでに精算済みです" };
    }
    return { error: "精算の記録に失敗しました" };
  }

  revalidatePath("/settlements");
  return undefined;
}

/** 精算を取り消す（RLS により実行者本人のみ削除できる。多層防御で household もスコープ）。 */
export async function deleteSettlement(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) {
    return;
  }

  const { householdId, supabase } = await requireDashboardContext();

  await supabase
    .from("settlements")
    .delete()
    .eq("id", id)
    .eq("household_id", householdId);

  revalidatePath("/settlements");
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run app/\(dashboard\)/settlements/actions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/(dashboard)/settlements
git commit -m "feat: 精算の確定・取り消し Server Action を追加"
```

---

### Task 7: `/settlements` ページ・コンポーネント・ナビ

**Files:**
- Create: `app/(dashboard)/settlements/page.tsx`
- Create: `components/features/settlements/settlement-view.tsx`
- Test: `components/features/settlements/settlement-view.test.tsx`
- Create: `components/features/settlements/settle-controls.tsx`（client）
- Test: `components/features/settlements/settle-controls.test.tsx`
- Modify: `components/features/layout/nav-items.ts` + `nav-items.test.ts`

**Interfaces:**
- Consumes: Task 2 の `SettlementResult`・`settlementsEqual`、Task 6 の `createSettlement`・`deleteSettlement`・`SettlementActionState`
- Produces: `/settlements` ルート、ナビ項目「精算」

- [ ] **Step 1: SettlementView の失敗するテストを書く**

`components/features/settlements/settlement-view.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { SettlementResult } from "@/lib/settlement";

import { SettlementView } from "./settlement-view";

const result: SettlementResult = {
  total: 4000,
  perMember: 2000,
  rows: [
    { userId: "u-1", displayName: "太郎", paid: 3000, balance: 1000 },
    { userId: "u-2", displayName: "花子", paid: 1000, balance: -1000 },
  ],
  transfers: [{ fromUserId: "u-2", toUserId: "u-1", amount: 1000 }],
};

describe("SettlementView", () => {
  it("合計・1人あたり負担額・メンバー別の立替と差額を表示する", () => {
    render(<SettlementView result={result} />);

    expect(screen.getByText("¥4,000")).toBeInTheDocument();
    expect(screen.getByText("¥2,000")).toBeInTheDocument();
    expect(screen.getByText("太郎")).toBeInTheDocument();
    expect(screen.getByText("¥1,000 受け取る")).toBeInTheDocument();
    expect(screen.getByText("¥1,000 支払う")).toBeInTheDocument();
  });

  it("送金案を「誰 → 誰」で表示する", () => {
    render(<SettlementView result={result} />);

    const transfer = screen.getByTestId("settlement-transfer");
    expect(transfer).toHaveTextContent("花子 → 太郎");
    expect(transfer).toHaveTextContent("¥1,000");
  });

  it("送金が不要なら「送金の必要はありません」を表示する", () => {
    render(
      <SettlementView result={{ ...result, transfers: [] }} />,
    );
    expect(screen.getByText("送金の必要はありません。")).toBeInTheDocument();
  });
});
```

Run: `npx vitest run components/features/settlements/settlement-view.test.tsx` → Expected: FAIL

- [ ] **Step 2: SettlementView を実装**

`components/features/settlements/settlement-view.tsx`（Server/Client 両用のプレゼンテーショナル）:

```tsx
import { CardContent } from "@/components/ui/card";
import { Surface } from "@/components/shared/surface";
import { yen } from "@/lib/format";
import type { SettlementResult } from "@/lib/settlement";
import { cn } from "@/lib/utils";

/** 精算結果（当期の再計算 or 精算済みスナップショット）の表示。 */
export function SettlementView({ result }: { result: SettlementResult }) {
  const nameById = new Map(result.rows.map((r) => [r.userId, r.displayName]));

  return (
    <div className="space-y-4">
      <Surface variant="raised">
        <CardContent className="grid grid-cols-2 gap-3 py-5">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              精算対象の支出合計
            </p>
            <p className="font-heading text-lg font-bold tabular-nums">
              {yen(result.total)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              1人あたり負担額
            </p>
            <p className="font-heading text-lg font-bold tabular-nums">
              {yen(result.perMember)}
            </p>
          </div>
        </CardContent>
      </Surface>

      <div className="grid gap-2 sm:grid-cols-2">
        {result.rows.map((row) => (
          <Surface
            key={row.userId}
            variant="raised"
            data-testid="settlement-member-row"
          >
            <CardContent className="space-y-1 py-4">
              <p className="text-sm font-medium">{row.displayName}</p>
              <p className="text-xs text-muted-foreground">
                立替 {yen(row.paid)}
              </p>
              <p
                className={cn(
                  "text-sm font-bold tabular-nums",
                  row.balance > 0
                    ? "text-income"
                    : row.balance < 0
                      ? "text-expense"
                      : "text-muted-foreground",
                )}
              >
                {row.balance > 0
                  ? `${yen(row.balance)} 受け取る`
                  : row.balance < 0
                    ? `${yen(-row.balance)} 支払う`
                    : "過不足なし"}
              </p>
            </CardContent>
          </Surface>
        ))}
      </div>

      {result.transfers.length > 0 ? (
        <Surface variant="raised">
          <CardContent className="space-y-2 py-4">
            <p className="text-xs font-medium text-muted-foreground">送金案</p>
            <ul className="space-y-1.5">
              {result.transfers.map((t, i) => (
                <li
                  key={i}
                  data-testid="settlement-transfer"
                  className="flex items-center justify-between text-sm"
                >
                  <span>
                    {nameById.get(t.fromUserId) ?? "不明なユーザー"} →{" "}
                    {nameById.get(t.toUserId) ?? "不明なユーザー"}
                  </span>
                  <span className="font-heading font-bold tabular-nums">
                    {yen(t.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Surface>
      ) : (
        <p className="text-sm text-muted-foreground">送金の必要はありません。</p>
      )}
    </div>
  );
}
```

Run: `npx vitest run components/features/settlements/settlement-view.test.tsx` → Expected: PASS

- [ ] **Step 3: SettleControls の失敗するテストを書く**

`components/features/settlements/settle-controls.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CancelSettlementButton, SettleButton } from "./settle-controls";

vi.mock("@/app/(dashboard)/settlements/actions", () => ({
  createSettlement: vi.fn(),
  deleteSettlement: vi.fn(),
}));

describe("SettleButton", () => {
  it("「精算済みにする」を押すと確認ダイアログが開く", async () => {
    render(<SettleButton refParam="2026-07-01" />);

    await userEvent.click(
      screen.getByRole("button", { name: "精算済みにする" }),
    );
    expect(
      screen.getByRole("button", { name: "精算を確定する" }),
    ).toBeVisible();
  });
});

describe("CancelSettlementButton", () => {
  it("取り消しは確認ステップを挟む", async () => {
    render(<CancelSettlementButton settlementId="s-1" />);

    await userEvent.click(screen.getByRole("button", { name: "取り消す" }));
    expect(
      screen.getByRole("button", { name: "精算を取り消す" }),
    ).toBeVisible();
  });
});
```

Run: `npx vitest run components/features/settlements/settle-controls.test.tsx` → Expected: FAIL

- [ ] **Step 4: SettleControls を実装**

`components/features/settlements/settle-controls.tsx`（確認は `components/ui/dialog.tsx` の Dialog を使用。Dialog が jsdom テストで扱いにくい場合は同等のインライン確認 UI でもよいが、確認ステップは必須）:

```tsx
"use client";

import { useActionState, useState } from "react";

import {
  createSettlement,
  deleteSettlement,
  type SettlementActionState,
} from "@/app/(dashboard)/settlements/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** 「精算済みにする」ボタン。確認ダイアログを挟んで createSettlement を実行する。 */
export function SettleButton({ refParam }: { refParam: string }) {
  const [state, formAction, pending] = useActionState<
    SettlementActionState,
    FormData
  >(createSettlement, undefined);

  return (
    <div className="space-y-2">
      <Dialog>
        <DialogTrigger asChild>
          <Button className="h-11 w-full text-base shadow-soft">
            精算済みにする
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>この期間を精算済みにしますか？</DialogTitle>
            <DialogDescription>
              現在の計算結果を記録します。以後この期間は精算済みとして表示されます。
            </DialogDescription>
          </DialogHeader>
          <form action={formAction}>
            <input type="hidden" name="ref" value={refParam} />
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "処理中..." : "精算を確定する"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {state && "error" in state ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}

/** 精算の取り消し（実行者本人のみ表示される想定）。二段階の確認を挟む。 */
export function CancelSettlementButton({
  settlementId,
}: {
  settlementId: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => setConfirming(true)}
      >
        取り消す
      </Button>
    );
  }

  return (
    <form action={deleteSettlement} className="flex items-center gap-2">
      <input type="hidden" name="id" value={settlementId} />
      <Button type="submit" variant="destructive">
        精算を取り消す
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => setConfirming(false)}
      >
        キャンセル
      </Button>
    </form>
  );
}
```

Run: `npx vitest run components/features/settlements/settle-controls.test.tsx` → Expected: PASS

- [ ] **Step 5: ページを実装**

`app/(dashboard)/settlements/page.tsx`（`/budgets` の page.tsx と同構成）:

```tsx
import { HandCoins } from "lucide-react";

import { CancelSettlementButton, SettleButton } from "@/components/features/settlements/settle-controls";
import { SettlementView } from "@/components/features/settlements/settlement-view";
import { MonthNav } from "@/components/features/transactions/month-nav";
import { CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Surface } from "@/components/shared/surface";
import {
  getHouseholdSettings,
  requireDashboardContext,
} from "@/lib/household";
import {
  formatPeriodLabel,
  getPeriodRange,
  refFromParam,
  shiftPeriod,
  toISODate,
} from "@/lib/period";
import { getHouseholdMemberNames } from "@/lib/queries/members";
import { fetchTransactionsInRange } from "@/lib/queries/transactions";
import { ensureRecurringGenerated } from "@/lib/recurring";
import {
  buildSettlement,
  settlementsEqual,
  type SettlementResult,
} from "@/lib/settlement";

export default async function SettlementsPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;

  const { user, householdId, supabase } = await requireDashboardContext();

  // 当期分の定期収支を（未生成なら）生成してから集計する。冪等。
  await ensureRecurringGenerated(householdId);

  const { periodStartDay: startDay } = await getHouseholdSettings(householdId);
  const range = getPeriodRange(refFromParam(ref), startDay);
  const periodStart = toISODate(range.start);

  const [txs, members, { data: settlement }] = await Promise.all([
    fetchTransactionsInRange(supabase, householdId, range),
    getHouseholdMemberNames(householdId),
    supabase
      .from("settlements")
      .select("id, settled_by, settled_at, snapshot")
      .eq("household_id", householdId)
      .eq("period_start", periodStart)
      .maybeSingle(),
  ]);

  const current = buildSettlement(txs, members);
  // 精算済みなら記録時点のスナップショットを表示する（後の取引編集に影響されない）。
  const snapshot = settlement
    ? (settlement.snapshot as unknown as SettlementResult)
    : null;
  const hasDiff = snapshot ? !settlementsEqual(snapshot, current) : false;
  const settledByName = settlement
    ? (members.find((m) => m.user_id === settlement.settled_by)?.display_name ??
      "不明なユーザー")
    : null;

  const prevHref = `/settlements?ref=${toISODate(shiftPeriod(range, -1, startDay).start)}`;
  const nextHref = `/settlements?ref=${toISODate(shiftPeriod(range, 1, startDay).start)}`;

  const reveal =
    "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 ease-out";

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:py-8">
      <PageHeader
        eyebrow="管理"
        title="精算"
        className={reveal}
        actions={
          <MonthNav
            label={formatPeriodLabel(range)}
            prevHref={prevHref}
            nextHref={nextHref}
          />
        }
      />

      {members.length < 2 ? (
        <Surface variant="raised" className={reveal}>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <HandCoins className="size-6" aria-hidden />
            </span>
            <p className="text-sm text-muted-foreground">
              精算の必要はありません。
              <br />
              メンバーが2人以上になると立て替えの精算ができます。
            </p>
          </CardContent>
        </Surface>
      ) : settlement && snapshot ? (
        <section className={reveal} data-testid="settlement-settled">
          <Surface variant="raised">
            <CardContent className="space-y-3 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-income/15 px-3 py-1 text-xs font-bold text-income">
                  精算済み
                </span>
                <span className="text-xs text-muted-foreground">
                  {settledByName} さんが{" "}
                  {new Date(settlement.settled_at).toLocaleDateString("ja-JP")}{" "}
                  に確定
                </span>
              </div>
              {hasDiff ? (
                <p className="text-sm text-destructive" role="alert">
                  現在の記帳内容と差異があります（精算後に対象の収支が変更されています）
                </p>
              ) : null}
            </CardContent>
          </Surface>
          <div className="mt-4">
            <SettlementView result={snapshot} />
          </div>
          {settlement.settled_by === user.id ? (
            <div className="mt-4">
              <CancelSettlementButton settlementId={settlement.id} />
            </div>
          ) : null}
        </section>
      ) : current.total === 0 ? (
        <Surface variant="raised" className={reveal}>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <HandCoins className="size-6" aria-hidden />
            </span>
            <p className="text-sm text-muted-foreground">
              この期間に精算対象の支出はありません。
              <br />
              収支の登録時に「精算対象（割り勘）」を付けると、ここで均等割りできます。
            </p>
          </CardContent>
        </Surface>
      ) : (
        <section className={reveal}>
          <SettlementView result={current} />
          <div className="mt-4">
            <SettleButton refParam={periodStart} />
          </div>
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 6: ナビに「精算」を追加**

`components/features/layout/nav-items.ts`:

1. import に `HandCoins` を追加
2. `NAV_ITEMS` の「予算」の直後に `{ href: "/settlements", label: "精算", icon: HandCoins },` を追加
3. `TAB_EXCLUDED` に `"/settlements"` を追加（モバイルタブは 4 件を維持。コメントの除外理由に「精算は管理系のため除外」を追記）

`nav-items.test.ts` の期待値（NAV_ITEMS の並び・TAB_ITEMS の件数など）を新項目に合わせて更新する。

- [ ] **Step 7: 全 Unit テスト + lint + 型チェック**

Run: `npm run test:run && npm run lint && npm run typecheck`
Expected: すべて PASS

- [ ] **Step 8: 動作確認（手動）**

`npm run dev` で `/settlements` を開き、(1) 1人グループで「精算の必要はありません」、(2) 精算対象支出の登録後に合計・送金案が出ること、(3) 精算済み → バッジ・取り消し、を目視確認する。

- [ ] **Step 9: Commit**

```bash
git add app/(dashboard)/settlements components/features/settlements components/features/layout/nav-items.ts components/features/layout/nav-items.test.ts
git commit -m "feat: メンバー間精算ページとナビを追加"
```

---

### Task 8: E2E テスト + ユーザーストーリー対応表

**Files:**
- Create: `e2e/settlements.spec.ts`
- Modify: `docs/user-stories.md`（spec 37 のストーリーを追記）

**Interfaces:**
- Consumes: Task 4〜7 の UI（チェックボックス「精算対象（割り勘）」、`/settlements` の表示・ボタン）。`e2e/helpers.ts#createHousehold`、`e2e/constants.ts#ephemeralName`・`E2E_MEMBER_USER`、招待参加フローは `e2e/household.spec.ts`（139〜181行）と同じ手順

- [ ] **Step 1: E2E テストを書く**

`e2e/settlements.spec.ts`:

```typescript
import { expect, test } from "@playwright/test";

import { E2E_MEMBER_USER, ephemeralName } from "./constants";
import { createHousehold } from "./helpers";

// ログイン済み（storageState）で実行される。
// 新規グループは period_start_day=1 のため、今日付の収支は当期に含まれる。

test.describe("メンバー間精算（割り勘）", () => {
  test("精算対象の支出を均等割りし、送金案の表示と精算の確定・取り消しができる", async ({
    page,
    browser,
    baseURL,
  }) => {
    const group = ephemeralName("精算グループ");
    const card = page
      .locator('[data-testid="household-card"]')
      .filter({ hasText: group });

    // オーナーがグループを作成し、精算対象の支出（3000円）と対象外の支出（500円）を登録
    await createHousehold(page, group);

    await page.goto("/transactions/new");
    await page.getByLabel("金額").fill("3000");
    await page.getByRole("radio", { name: "食費" }).check();
    await page.getByRole("checkbox", { name: /精算対象（割り勘）/ }).check();
    await page.getByRole("button", { name: "登録する" }).click();
    await expect(page).toHaveURL(/\/transactions$/);

    await page.goto("/transactions/new");
    await page.getByLabel("金額").fill("500");
    await page.getByRole("button", { name: "登録する" }).click();
    await expect(page).toHaveURL(/\/transactions$/);

    // 一覧に「精算」バッジが対象行のみ表示される
    const sharedRow = page
      .locator('[data-testid="transaction-row"]')
      .filter({ hasText: "¥3,000" });
    await expect(sharedRow.getByText("精算", { exact: true })).toBeVisible();

    // 1人の間は精算不要と表示される
    await page.goto("/settlements");
    await expect(page.getByText("精算の必要はありません。")).toBeVisible();

    // 招待リンクを発行し、2人目（テストメンバー）が参加する
    await page.goto("/households");
    await card.getByRole("button", { name: /^管理（メンバー/ }).click();
    await card.getByLabel("参加できる人数").fill("2");
    await card.getByRole("button", { name: "招待リンクを発行" }).click();
    const linkInput = card.locator('input[readonly][value*="/invite/"]').first();
    await expect(linkInput).toBeVisible();
    const inviteUrl = await linkInput.inputValue();

    const memberContext = await browser.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
    });
    const memberPage = await memberContext.newPage();
    await memberPage.goto("/login");
    await memberPage.getByLabel("メールアドレス").fill(E2E_MEMBER_USER.email);
    await memberPage.getByLabel("パスワード").fill(E2E_MEMBER_USER.password);
    await memberPage.getByRole("button", { name: "ログイン" }).click();
    await expect(memberPage).toHaveURL(/\/households$/);
    await memberPage.goto(inviteUrl);
    await memberPage
      .getByRole("button", { name: "このグループに参加する" })
      .click();
    await expect(memberPage).toHaveURL(/\/dashboard$/);

    // 2人目が精算対象の支出（1000円）を登録
    await memberPage.goto("/transactions/new");
    await memberPage.getByLabel("金額").fill("1000");
    await memberPage
      .getByRole("checkbox", { name: /精算対象（割り勘）/ })
      .check();
    await memberPage.getByRole("button", { name: "登録する" }).click();
    await expect(memberPage).toHaveURL(/\/transactions$/);

    // オーナー側の精算ページ: 合計4000・1人2000・テストメンバー→オーナー ¥1,000
    await page.goto("/settlements");
    await expect(page.getByText("¥4,000")).toBeVisible();
    await expect(page.getByText("¥2,000")).toBeVisible();
    const transfer = page.getByTestId("settlement-transfer");
    await expect(transfer).toContainText(E2E_MEMBER_USER.displayName);
    await expect(transfer).toContainText("¥1,000");

    // 精算を確定すると精算済みバッジが表示される
    await page.getByRole("button", { name: "精算済みにする" }).click();
    await page.getByRole("button", { name: "精算を確定する" }).click();
    await expect(page.getByText("精算済み", { exact: true })).toBeVisible();

    // 精算後に対象の支出を追加すると差異警告が表示される
    await page.goto("/transactions/new");
    await page.getByLabel("金額").fill("800");
    await page.getByRole("checkbox", { name: /精算対象（割り勘）/ }).check();
    await page.getByRole("button", { name: "登録する" }).click();
    await page.goto("/settlements");
    await expect(
      page.getByText(/現在の記帳内容と差異があります/),
    ).toBeVisible();

    // 実行者本人は取り消しでき、未精算の表示に戻る
    await page.getByRole("button", { name: "取り消す" }).click();
    await page.getByRole("button", { name: "精算を取り消す" }).click();
    await expect(
      page.getByRole("button", { name: "精算済みにする" }),
    ).toBeVisible();

    await memberContext.close();
  });
});
```

- [ ] **Step 2: E2E 実行（新規 spec のみで先に確認）**

Run: `npx playwright test e2e/settlements.spec.ts --workers=1`
Expected: PASS。セレクタずれ（バッジの `exact` 判定・ダイアログのボタン名など）があれば実装ではなくテスト側を実 UI に合わせて修正する

- [ ] **Step 3: `docs/user-stories.md` に spec 37 のストーリーを追記**

既存フォーマット（対応表）に合わせて追記する:

- As a グループのメンバー / I want 立て替えた支出に精算対象の印を付けたい → `e2e/settlements.spec.ts`（フォームのチェック・一覧バッジ）
- As a グループのメンバー / I want 当期の立て替えを均等割りして誰が誰にいくら払うか知りたい → `e2e/settlements.spec.ts`（送金案の表示）
- As a グループのメンバー / I want 精算した期間を確定して記録したい（誤操作は取り消したい） → `e2e/settlements.spec.ts`（確定・差異警告・取り消し）
- 均等割りの端数処理・脱退者除外などの計算詳細 → `lib/settlement.test.ts`（Unit で検証。E2E は代表値のみ）

- [ ] **Step 4: Commit**

```bash
git add e2e/settlements.spec.ts docs/user-stories.md
git commit -m "test: メンバー間精算のE2Eを追加"
```

---

### Task 9: 全体検証とドキュメント更新（Rule 5）

**Files:**
- Modify: `docs/sessions/2026-07-03_member-settlement.md`（やったこと・決定事項を反映）
- Modify（必要時のみ）: 失敗したテスト・実装の修正

- [ ] **Step 1: Unit/Component 全実行**

Run: `npm run test:run`
Expected: 全 PASS

- [ ] **Step 2: lint + 型チェック + ビルド**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: エラー 0

- [ ] **Step 3: E2E を CI 同条件で全実行**

Run: `npm run test:e2e -- --workers=1`
Expected: **全テスト PASS**（settlements 以外の既存 spec も含む。ナビ追加による navigation.spec.ts への影響、`transaction-row` 内のバッジ追加による transactions 系 spec への影響に注意）。失敗があれば修正 → 再実行を全通過まで繰り返す（Rule 5）

- [ ] **Step 4: セッションログを更新して Commit**

`docs/sessions/2026-07-03_member-settlement.md` の「やったこと」「次にやること」を実績で更新する。

```bash
git add docs/sessions/2026-07-03_member-settlement.md
git commit -m "docs: メンバー間精算のセッションログを更新"
```
