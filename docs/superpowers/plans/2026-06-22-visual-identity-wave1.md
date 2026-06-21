# ビジュアル統一 波1（コア体験への適用）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dashboard / transactions / analytics の3コア画面を波0の共通プリミティブで再構成し、最上部・節見出し・カード面・金額・KPI 表現を全画面で統一する。

**Architecture:** 波0で作った `components/shared/` のプリミティブ（PageHeader/SectionHeading/Surface/Amount/KpiRibbon 等）を各ページへ適用する。ページのデータ取得・Server Actions・ルーティングは一切変更せず、`return (...)` の JSX とインポートのみ差し替える。あわせて PageHeader に meta スロットを足し、波0の繰り越し Minor（Tone 型共通化・孤立フォント削除・AnimatedNumber テスト拡充）を解消する。

**Tech Stack:** Next.js App Router / TypeScript / Tailwind CSS v4 / shadcn/ui / Vitest + RTL / Playwright（E2E）/ lucide-react

## Global Constraints

- `components/ui/`（shadcn）は直接編集しない。世界観は `components/shared/` とページ側で作る。
- 機能・URL・データ挙動は不変（見た目とマークアップのみ）。Server Actions / 取得ロジックは変更しない。
- 既存テストを壊さない。特に以下を**必ず維持**する:
  - `data-testid="summary-cards"` / `data-testid="dashboard-transaction-row"` / `data-testid="transaction-row"` / `data-testid="category-member-matrix"` / `data-testid="matrix-expense"`
  - 画面見出しテキスト: h1「ダッシュボード」「収支」「分析」、節見出し「カテゴリ別支出（当期）」「月別推移（直近6期）」（**完全一致**）
  - 金額テキストの部分一致（例: `¥1,200`）。`Amount` は `-¥1,200` を描画するが substring 一致は保たれる。
- **SummaryCards は据え置き**（`summary-cards.test.tsx` が金額テキストを直接検証しており、AnimatedNumber 化すると壊れるため）。
- E2E（`getByText`）衝突を避ける。分析ページの KPI で当期支出合計/収支/カテゴリ名を本文に重複させない既存方針を維持する。
- ライト/ダーク両対応。全モーションは `prefers-reduced-motion` で停止（AnimatedNumber は JS、その他は `motion-safe:`）。
- 各ファイルのテストは co-located。import エイリアス `@/`。
- コミットメッセージは `<type>: <日本語説明>`、末尾に `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。
- 検証コマンド: `npm run typecheck` / `npm run lint` / `npm run test:run`。

---

### Task 1: PageHeader に meta スロットを追加

dashboard（期間ラベル）と transactions（「N件の記録」）はタイトル下にサブ行を持つ。PageHeader にオプションの `meta` スロットを足して両ページで使えるようにする。

**Files:**
- Modify: `components/shared/page-header.tsx`
- Modify: `components/shared/page-header.test.tsx`

**Interfaces:**
- Produces: `PageHeader({ eyebrow?: string; title: string; meta?: React.ReactNode; actions?: React.ReactNode; className?: string })`。`meta` はタイトル直下に muted・tabular-nums で描画。

- [ ] **Step 1: 失敗するテストを追加**

`components/shared/page-header.test.tsx` の `describe("PageHeader", ...)` 内に追加:

```tsx
  it("meta をタイトル下に描画する", () => {
    render(<PageHeader title="収支" meta="3件の記録" />);
    expect(screen.getByText("3件の記録")).toBeInTheDocument();
  });
```

- [ ] **Step 2: 失敗を確認**

Run: `npm run test:run -- page-header`
Expected: 新テストが FAIL（meta 未対応）。既存2件は PASS。

- [ ] **Step 3: meta スロットを実装**

`components/shared/page-header.tsx` を次の内容に置き換える:

```tsx
import * as React from "react";

import { cn } from "@/lib/utils";

type Props = {
  /** 英字トラッキングの小見出し（任意）。 */
  eyebrow?: string;
  title: string;
  /** タイトル直下のサブ情報（期間・件数など、任意）。 */
  meta?: React.ReactNode;
  /** 右側に並べる操作（任意）。 */
  actions?: React.ReactNode;
  className?: string;
};

/** 全ページ共通の最上部見出し（eyebrow + タイトル + meta + 操作スロット）。 */
export function PageHeader({ eyebrow, title, meta, actions, className }: Props) {
  return (
    <header
      className={cn("flex flex-wrap items-end justify-between gap-3", className)}
    >
      <div className="space-y-1">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h1>
        {meta ? (
          <p className="text-sm font-medium text-muted-foreground tabular-nums">
            {meta}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test:run -- page-header`
Expected: 3 tests PASS。

- [ ] **Step 5: コミット**

```bash
git add components/shared/page-header.tsx components/shared/page-header.test.tsx
git commit -m "$(printf 'feat: PageHeader に meta スロットを追加\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 2: tone トークンを共通化

`IconChip` と `StatTile` が `Tone` 型と配色マップを各自重複定義している（波0最終レビューの繰り越し Minor）。`components/shared/tone.ts` に集約して両者から参照する。

**Files:**
- Create: `components/shared/tone.ts`
- Create: `components/shared/tone.test.ts`
- Modify: `components/shared/icon-chip.tsx`
- Modify: `components/shared/stat-tile.tsx`

**Interfaces:**
- Produces: `type Tone = "income" | "expense" | "neutral"`; `TONE_CHIP: Record<Tone,string>`（チップ背景＋文字色）; `TONE_TEXT: Record<Tone,string>`（数値文字色）。

- [ ] **Step 1: 失敗するテストを書く**

`components/shared/tone.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { TONE_CHIP, TONE_TEXT } from "./tone";

describe("tone tokens", () => {
  it("チップ配色は income/expense/neutral を網羅する", () => {
    expect(TONE_CHIP.income).toContain("text-income");
    expect(TONE_CHIP.expense).toContain("text-expense");
    expect(TONE_CHIP.neutral).toContain("text-secondary-foreground");
  });

  it("数値文字色は income/expense/neutral を網羅する", () => {
    expect(TONE_TEXT.income).toBe("text-income");
    expect(TONE_TEXT.expense).toBe("text-expense");
    expect(TONE_TEXT.neutral).toBe("text-foreground");
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm run test:run -- tone`
Expected: FAIL（`./tone` 未作成）。

- [ ] **Step 3: tone.ts を実装**

`components/shared/tone.ts`:

```ts
/** 収支トーン。income=収入 / expense=支出 / neutral=中立。 */
export type Tone = "income" | "expense" | "neutral";

/** 丸チップなどの「背景＋文字色」セット。 */
export const TONE_CHIP: Record<Tone, string> = {
  income: "bg-income-soft text-income",
  expense: "bg-expense-soft text-expense",
  neutral: "bg-secondary text-secondary-foreground",
};

/** 数値・テキストの文字色のみ。 */
export const TONE_TEXT: Record<Tone, string> = {
  income: "text-income",
  expense: "text-expense",
  neutral: "text-foreground",
};
```

- [ ] **Step 4: IconChip を共通トークンへ移行**

`components/shared/icon-chip.tsx` を次に置き換える:

```tsx
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { TONE_CHIP, type Tone } from "./tone";

type Props = {
  icon: LucideIcon;
  label?: string;
  tone?: Tone;
  className?: string;
};

/** 丸い背景にアイコンを載せた小さなチップ。 */
export function IconChip({ icon: Icon, label, tone = "neutral", className }: Props) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full",
        TONE_CHIP[tone],
        className,
      )}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      <Icon className="size-4" aria-hidden />
    </span>
  );
}
```

- [ ] **Step 5: StatTile を共通トークンへ移行**

`components/shared/stat-tile.tsx` を次に置き換える:

```tsx
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { AnimatedNumber } from "./animated-number";
import { IconChip } from "./icon-chip";
import { TONE_TEXT, type Tone } from "./tone";

type Props = {
  label: string;
  value: number;
  format?: (n: number) => string;
  icon?: LucideIcon;
  tone?: Tone;
  className?: string;
};

/** アイコンチップ + ラベル + カウントアップ値のタイル。 */
export function StatTile({
  label,
  value,
  format,
  icon,
  tone = "neutral",
  className,
}: Props) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-2">
        {icon ? <IconChip icon={icon} tone={tone} /> : null}
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <AnimatedNumber
        value={value}
        format={format}
        className={cn(
          "font-heading text-xl font-bold tabular-nums",
          TONE_TEXT[tone],
        )}
      />
    </div>
  );
}
```

- [ ] **Step 6: 全テスト緑を確認**

Run: `npm run test:run -- tone icon-chip stat-tile`
Expected: すべて PASS（既存 icon-chip/stat-tile テストは配色クラス不変のため通る）。続けて `npm run typecheck`。

- [ ] **Step 7: コミット**

```bash
git add components/shared/tone.ts components/shared/tone.test.ts components/shared/icon-chip.tsx components/shared/stat-tile.tsx
git commit -m "$(printf 'refactor: tone トークンを components/shared/tone.ts に共通化\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 3: ダッシュボードに共通プリミティブを適用

最上部を `PageHeader`、「当期の収支」を `SectionHeading`、カード面を `Surface`、最近の取引の金額を `Amount` に置き換える。SummaryCards / CategoryMemberMatrix / BalanceBarChart / 各 `data-testid` / 見出し文言は維持する。

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `PageHeader`（meta あり, Task 1）/ `SectionHeading` / `Surface` / `Amount`（`components/shared/`）。

- [ ] **Step 1: import を差し替え**

`app/(dashboard)/dashboard/page.tsx` の先頭インポート群のうち、`Card` 系インポートと `yen` を見直す。次のように変更する（他の import 行はそのまま）:

- 削除: `import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";`
- 追加:
```tsx
import { CardContent } from "@/components/ui/card";
import { Amount } from "@/components/shared/amount";
import { PageHeader } from "@/components/shared/page-header";
import { SectionHeading } from "@/components/shared/section-heading";
import { Surface } from "@/components/shared/surface";
```
- `import { formatDayLabel, groupByDate, yen } from "@/lib/format";` を `import { formatDayLabel, groupByDate } from "@/lib/format";` に変更（`yen` は `Amount` に集約され未使用になる）。

- [ ] **Step 2: return 本体を差し替え**

`return (` 〜 ファイル末尾の `);}` を次に置き換える（データ取得ロジックは一切変更しない）:

```tsx
  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:py-8">
      <PageHeader
        eyebrow="ホーム"
        title="ダッシュボード"
        meta={formatPeriodLabel(range)}
        className={reveal}
        actions={
          <>
            <ScopeToggle scope={scope} />
            <Link
              href="/transactions/new"
              className={buttonVariants({ size: "sm" })}
            >
              <Plus className="size-4" aria-hidden />
              記録する
            </Link>
          </>
        }
      />

      <div className={reveal} style={{ animationDelay: "60ms" }}>
        <SummaryCards
          income={income}
          expense={expense}
          prevIncome={sumBy(prevTransactions, "income")}
          prevExpense={sumBy(prevTransactions, "expense")}
        />
      </div>

      <div className={reveal} style={{ animationDelay: "120ms" }}>
        <SectionHeading>当期の収支</SectionHeading>
        <Surface variant="raised">
          <CardContent>
            <BalanceBarChart income={income} expense={expense} />
          </CardContent>
        </Surface>
      </div>

      <div className={reveal} style={{ animationDelay: "180ms" }}>
        <CategoryMemberMatrix matrix={matrix} />
      </div>

      <div className={reveal} style={{ animationDelay: "240ms" }}>
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-base font-bold">最近の取引</h2>
          <Link
            href="/transactions"
            className={buttonVariants({ variant: "link", size: "sm" })}
          >
            すべて見る
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>

        {recentGroups.length === 0 ? (
          <Surface variant="raised" className="mt-2">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                <ReceiptText className="size-6" aria-hidden />
              </span>
              <p className="text-sm text-muted-foreground">
                この期間の収支はまだありません。
                <br />
                最初の一件を記録してみましょう。
              </p>
              <Link
                href="/transactions/new"
                className={buttonVariants({ size: "sm" })}
              >
                収支を記録
              </Link>
            </CardContent>
          </Surface>
        ) : (
          <div className="mt-2 space-y-4">
            {recentGroups.map((group) => (
              <section key={group.date} className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground tabular-nums">
                  {formatDayLabel(group.date)}
                </h3>
                <ul className="space-y-2">
                  {group.items.map((t) => (
                    <li key={t.id}>
                      <Surface
                        variant="raised"
                        data-testid="dashboard-transaction-row"
                        className="transition-shadow hover:shadow-lifted"
                      >
                        <CardContent className="flex items-center justify-between gap-3 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              aria-hidden
                              className={cn(
                                "h-9 w-1 shrink-0 rounded-full",
                                t.type === "income"
                                  ? "bg-income"
                                  : "bg-expense",
                              )}
                            />
                            <div className="min-w-0 space-y-0.5">
                              <CategoryBadge category={t.category} />
                              {t.memo ? (
                                <p className="truncate text-xs text-muted-foreground">
                                  {t.memo}
                                </p>
                              ) : null}
                            </div>
                          </div>
                          <Amount
                            value={t.amount}
                            type={t.type}
                            className="shrink-0"
                          />
                        </CardContent>
                      </Surface>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: 型・lint・ユニットテスト**

Run: `npm run typecheck && npm run lint && npm run test:run`
Expected: すべて PASS（318/319 のユニットは不変）。`yen` 未使用エラーが出たら import から外し漏れがないか確認。

- [ ] **Step 4: E2E（dashboard）で回帰確認**

Run: `npm run test:e2e -- dashboard`
Expected: PASS（`summary-cards` の `¥1,200`、`matrix-expense`、`dashboard-transaction-row` 可視、scope 切替がすべて通る）。

- [ ] **Step 5: コミット**

```bash
git add "app/(dashboard)/dashboard/page.tsx"
git commit -m "$(printf 'feat: ダッシュボードに共通プリミティブを適用\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 4: 収支一覧に共通プリミティブを適用

最上部を `PageHeader`（meta=「N件の記録」）、各カードを `Surface`、明細と日次小計の金額を `Amount` に置き換える。`data-testid="transaction-row"`・編集/削除フォーム・MonthNav・sticky 日付見出しは維持する。

**Files:**
- Modify: `app/(dashboard)/transactions/page.tsx`

**Interfaces:**
- Consumes: `PageHeader`（meta）/ `Surface` / `Amount`。

- [ ] **Step 1: import を差し替え**

- 削除: `import { Card, CardContent } from "@/components/ui/card";`
- 追加:
```tsx
import { CardContent } from "@/components/ui/card";
import { Amount } from "@/components/shared/amount";
import { PageHeader } from "@/components/shared/page-header";
import { Surface } from "@/components/shared/surface";
```
- `import { formatDayLabel, groupByDate, yen } from "@/lib/format";` は **そのまま**（`yen` は日次小計の `Amount` 置換後に未使用になるので、置換後 lint で未使用と出たら `yen` を外す。Step 3 で確認）。

- [ ] **Step 2: return 本体を差し替え**

`return (` 〜 末尾の `);}` を次に置き換える（取得ロジック・`daySums`・`refFromParam` は不変）:

```tsx
  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:py-8">
      <PageHeader
        eyebrow="記録"
        title="収支"
        meta={`${transactions.length}件の記録`}
        className={reveal}
        actions={
          <>
            {/* Route Handler（CSV）へは素の <a> を使う。<Link> だと RSC を
                プリフェッチしようとして "unexpected response" エラーになる。 */}
            <a
              href={`/transactions/export?ref=${toISODate(range.start)}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Download className="size-4" aria-hidden />
              <span className="max-sm:sr-only">CSV出力</span>
            </a>
            <Link
              href="/transactions/import"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Upload className="size-4" aria-hidden />
              <span className="max-sm:sr-only">インポート</span>
            </Link>
            <Link
              href="/transactions/new"
              className={buttonVariants({ variant: "default", size: "sm" })}
            >
              <Plus className="size-4" aria-hidden />
              収支を追加
            </Link>
          </>
        }
      />

      <div
        className={cn("flex justify-center", reveal)}
        style={{ animationDelay: "60ms" }}
      >
        <MonthNav
          label={formatPeriodLabel(range)}
          prevHref={prevHref}
          nextHref={nextHref}
        />
      </div>

      <div className={reveal} style={{ animationDelay: "120ms" }}>
        <SummaryCards income={income} expense={expense} />
      </div>

      {groups.length === 0 ? (
        <Surface
          variant="raised"
          className={cn("", reveal)}
          style={{ animationDelay: "180ms" }}
        >
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <ReceiptText className="size-6" aria-hidden />
            </span>
            <p className="text-sm text-muted-foreground">
              この期間の収支はまだありません。
            </p>
            <Link
              href="/transactions/new"
              className={buttonVariants({ size: "sm" })}
            >
              収支を記録
            </Link>
          </CardContent>
        </Surface>
      ) : (
        <div
          className={cn("space-y-6", reveal)}
          style={{ animationDelay: "180ms" }}
        >
          {groups.map((group) => {
            const sums = daySums(group.items);
            return (
              <section key={group.date} className="space-y-2">
                {/* 台帳の日付見出し。スクロール時はヘッダー直下に貼り付く。 */}
                <div className="sticky top-16 z-20 flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full border bg-card/85 px-3 py-1 font-heading text-xs font-semibold tabular-nums shadow-soft ring-1 ring-foreground/5 backdrop-blur-md">
                    {formatDayLabel(group.date)}
                  </span>
                  <span className="flex items-center gap-2 text-[11px] font-medium tabular-nums">
                    {sums.income > 0 ? (
                      <Amount
                        value={sums.income}
                        type="income"
                        className="text-[11px] font-medium"
                      />
                    ) : null}
                    {sums.expense > 0 ? (
                      <Amount
                        value={sums.expense}
                        type="expense"
                        className="text-[11px] font-medium"
                      />
                    ) : null}
                  </span>
                </div>

                <ul className="space-y-2">
                  {group.items.map((t) => {
                    const mine = t.created_by === user.id;
                    return (
                      <li key={t.id}>
                        <Surface
                          variant="raised"
                          data-testid="transaction-row"
                          className="group/row overflow-hidden p-0 transition-shadow hover:shadow-lifted"
                        >
                          <CardContent className="flex items-stretch gap-0 p-0">
                            {/* タイプ色のレジャーエッジ */}
                            <span
                              aria-hidden
                              className={cn(
                                "w-1.5 shrink-0",
                                t.type === "income"
                                  ? "bg-income"
                                  : "bg-expense",
                              )}
                            />
                            <div className="flex flex-1 items-center justify-between gap-3 px-4 py-3">
                              <div className="min-w-0 space-y-0.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <CategoryBadge category={t.category} />
                                  {!mine ? (
                                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                      他のメンバー
                                    </span>
                                  ) : null}
                                </div>
                                {t.memo ? (
                                  <p className="truncate text-xs text-muted-foreground">
                                    {t.memo}
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <Amount value={t.amount} type={t.type} />
                                {mine ? (
                                  <div className="flex items-center transition-opacity sm:opacity-0 sm:group-hover/row:opacity-100 sm:group-focus-within/row:opacity-100">
                                    <Link
                                      href={`/transactions/${t.id}/edit`}
                                      aria-label="編集"
                                      className={cn(
                                        buttonVariants({
                                          variant: "ghost",
                                          size: "icon",
                                        }),
                                        "size-8 text-muted-foreground hover:text-foreground",
                                      )}
                                    >
                                      <Pencil className="size-4" aria-hidden />
                                    </Link>
                                    <form action={deleteTransaction}>
                                      <input
                                        type="hidden"
                                        name="id"
                                        value={t.id}
                                      />
                                      <Button
                                        type="submit"
                                        variant="ghost"
                                        size="icon"
                                        aria-label="削除"
                                        className="size-8 text-muted-foreground hover:text-destructive"
                                      >
                                        <Trash2 className="size-4" aria-hidden />
                                      </Button>
                                    </form>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </CardContent>
                        </Surface>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
```

注: 上記で `tone` 変数（旧 `text-income/expense` 文字列）は `Amount` 化で不要になったため削除している。`yen` も未使用になる。

- [ ] **Step 3: 型・lint・ユニットテスト**

Run: `npm run typecheck && npm run lint && npm run test:run`
Expected: すべて PASS。`yen` 未使用 lint エラーが出たら `import { formatDayLabel, groupByDate } from "@/lib/format";` に修正して再実行。

- [ ] **Step 4: E2E（transactions）で回帰確認**

Run: `npm run test:e2e -- transactions`
Expected: PASS（追加→`transaction-row` に `¥1,200`、編集→`¥3,500`、削除が通る）。

- [ ] **Step 5: コミット**

```bash
git add "app/(dashboard)/transactions/page.tsx"
git commit -m "$(printf 'feat: 収支一覧に共通プリミティブを適用\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 5: 分析ページに共通プリミティブを適用

最上部を `PageHeader`、KPI を `KpiRibbon`、2つの番号付き節見出しを `SectionHeading`（index）に置き換える。装飾ウォーターマーク・`CategoryBreakdown`・`TrendBars`・節見出しテキスト（完全一致）は維持する。

**Files:**
- Modify: `app/(dashboard)/analytics/page.tsx`

**Interfaces:**
- Consumes: `PageHeader`（actions=MonthNav）/ `SectionHeading`（index）/ `KpiRibbon`（items: `{label, value: number, format?, unit?}[]`）。

- [ ] **Step 1: import を差し替え**

- 削除: `import { Card, CardContent } from "@/components/ui/card";`
- 追加:
```tsx
import { CardContent } from "@/components/ui/card";
import { KpiRibbon } from "@/components/shared/kpi-ribbon";
import { PageHeader } from "@/components/shared/page-header";
import { SectionHeading } from "@/components/shared/section-heading";
import { Surface } from "@/components/shared/surface";
```
- `yen` import はそのまま使う（KPI の format に使用）。

- [ ] **Step 2: KPI 配列を数値ベースに変更**

`const kpis = [ ... ];`（現状の文字列ベース）を次に置き換える。直前に丸め整形ヘルパーを定義する:

```tsx
  // KPI（テスト衝突回避のため当期支出合計・収支・カテゴリ名は本文に重複させない）。
  const current = trend[trend.length - 1];
  const totalExpense = categories.reduce((s, c) => s + c.amount, 0) || 1;
  const avgExpense = Math.round(
    trend.reduce((s, t) => s + t.expense, 0) / trend.length,
  );
  const topShare = categories.length
    ? Math.round((categories[0].amount / totalExpense) * 100)
    : 0;

  // カウントアップ中の小数を避けるため丸めてから円整形する。
  const yenRound = (n: number) => yen(Math.round(n));

  const kpis = [
    { label: "当期収入", value: current.income, format: yenRound },
    { label: "支出カテゴリ", value: categories.length, unit: "件" },
    { label: "最多占有", value: topShare, unit: "%" },
    { label: "月平均支出", value: avgExpense, format: yenRound },
  ];
```

- [ ] **Step 3: return 本体を差し替え**

`return (` 〜 末尾の `);}` を次に置き換える:

```tsx
  return (
    <main className="relative mx-auto w-full max-w-4xl space-y-6 overflow-hidden p-4 sm:py-8">
      {/* エディトリアルな装飾ウォーターマーク */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-8 -z-10 select-none font-heading text-[15rem] font-bold leading-none text-foreground/[0.035] sm:text-[18rem]"
      >
        ¥
      </span>

      <PageHeader
        eyebrow="Analytics · 家計の年鑑"
        title="分析"
        className={reveal}
        actions={
          <MonthNav
            label={formatPeriodLabel(base)}
            prevHref={prevHref}
            nextHref={nextHref}
          />
        }
      />

      {/* KPI リボン */}
      <div className={reveal} style={{ animationDelay: "60ms" }}>
        <KpiRibbon items={kpis} />
      </div>

      {/* カテゴリ別支出（showpiece） */}
      <section className={reveal} style={{ animationDelay: "120ms" }}>
        <SectionHeading index={1}>カテゴリ別支出（当期）</SectionHeading>
        <Surface variant="raised">
          <CardContent className="py-5">
            <CategoryBreakdown data={categories} />
          </CardContent>
        </Surface>
      </section>

      {/* 月別推移 */}
      <section className={reveal} style={{ animationDelay: "180ms" }}>
        <SectionHeading index={2}>月別推移（直近6期）</SectionHeading>
        <Surface variant="raised">
          <CardContent className="py-5">
            <TrendBars data={trend} />
          </CardContent>
        </Surface>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: 型・lint・ユニットテスト**

Run: `npm run typecheck && npm run lint && npm run test:run`
Expected: すべて PASS。

- [ ] **Step 5: E2E（analytics）で回帰確認**

Run: `npm run test:e2e -- analytics`
Expected: PASS（節見出し「月別推移（直近6期）」「カテゴリ別支出（当期）」可視、`食費`/`¥1,200` 可視、次期間で「当期の支出はまだありません。」可視）。

- [ ] **Step 6: コミット**

```bash
git add "app/(dashboard)/analytics/page.tsx"
git commit -m "$(printf 'feat: 分析ページに共通プリミティブを適用\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 6: 3画面の loading スケルトンをふっくら影に揃える

`Card className="shadow-soft ring-0"` を `Surface variant="raised"` に置き換え、本実装のカード面トーンと一致させる（構造・文言なし、視覚のみ）。

**Files:**
- Modify: `app/(dashboard)/dashboard/loading.tsx`
- Modify: `app/(dashboard)/transactions/loading.tsx`
- Modify: `app/(dashboard)/analytics/loading.tsx`

**Interfaces:**
- Consumes: `Surface`。

- [ ] **Step 1: dashboard/loading.tsx を置き換え**

```tsx
import { CardContent, CardHeader } from "@/components/ui/card";
import { Surface } from "@/components/shared/surface";

/** ダッシュボードのデータ取得中に表示するスケルトン。 */
export default function DashboardLoading() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:py-8">
      <div className="h-8 w-40 animate-pulse rounded-md bg-muted/60" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-24 animate-pulse rounded-xl bg-muted/60" />
        <div className="h-24 animate-pulse rounded-xl bg-muted/60" />
      </div>
      <Surface variant="raised">
        <CardHeader>
          <div className="h-5 w-28 animate-pulse rounded-md bg-muted/60" />
        </CardHeader>
        <CardContent>
          <div className="h-56 w-full animate-pulse rounded-md bg-muted/60" />
        </CardContent>
      </Surface>
      <div className="h-40 w-full animate-pulse rounded-xl bg-muted/60" />
    </main>
  );
}
```

- [ ] **Step 2: transactions/loading.tsx を置き換え**

```tsx
import { CardContent } from "@/components/ui/card";
import { Surface } from "@/components/shared/surface";

/** 収支一覧のデータ取得中に表示するスケルトン。 */
export default function TransactionsLoading() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:py-8">
      <div className="flex items-center justify-between">
        <div className="h-8 w-24 animate-pulse rounded-md bg-muted/60" />
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted/60" />
      </div>
      <div className="h-10 w-full animate-pulse rounded-md bg-muted/60" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-24 animate-pulse rounded-xl bg-muted/60" />
        <div className="h-24 animate-pulse rounded-xl bg-muted/60" />
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <Surface key={i} variant="raised">
            <CardContent className="flex items-center justify-between py-3">
              <div className="h-5 w-32 animate-pulse rounded-md bg-muted/60" />
              <div className="h-5 w-20 animate-pulse rounded-md bg-muted/60" />
            </CardContent>
          </Surface>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: analytics/loading.tsx を置き換え**

```tsx
import { CardContent, CardHeader } from "@/components/ui/card";
import { Surface } from "@/components/shared/surface";

/** 分析ページのデータ取得中に表示するスケルトン。 */
export default function AnalyticsLoading() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:py-8">
      <div className="h-8 w-24 animate-pulse rounded-md bg-muted/60" />
      <div className="h-10 w-full animate-pulse rounded-md bg-muted/60" />
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <Surface key={i} variant="raised">
            <CardHeader>
              <div className="h-5 w-36 animate-pulse rounded-md bg-muted/60" />
            </CardHeader>
            <CardContent>
              <div className="h-56 w-full animate-pulse rounded-md bg-muted/60" />
            </CardContent>
          </Surface>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: 型・lint・ビルド**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: すべて成功。

- [ ] **Step 5: コミット**

```bash
git add "app/(dashboard)/dashboard/loading.tsx" "app/(dashboard)/transactions/loading.tsx" "app/(dashboard)/analytics/loading.tsx"
git commit -m "$(printf 'feat: 各画面の loading スケルトンを Surface に統一\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 7: 孤立した M PLUS Rounded フォント読込を削除

波0で `--font-heading` を Zen Maru Gothic に切替えたため、`M_PLUS_Rounded_1c` の読込と `--font-mplus-rounded` 変数は参照されていない（波0最終レビューの繰り越し Minor）。読込を削除する。

**Files:**
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: なし（不要なフォントフェッチの除去）。

- [ ] **Step 1: 未参照を確認**

Run: `grep -rn "font-mplus-rounded\|M_PLUS_Rounded\|mPlusRounded" app/ components/`
Expected: 一致は `app/layout.tsx` 内のみ（定義・適用のみで、他からの参照なし）。1件でも他ファイルから参照があれば STOP して報告。

- [ ] **Step 2: layout.tsx から削除**

`app/layout.tsx` で次を行う:
- import を `import { Geist_Mono, Noto_Sans_JP, Zen_Maru_Gothic } from "next/font/google";` に変更（`M_PLUS_Rounded_1c` を除去）。
- `const mPlusRounded = M_PLUS_Rounded_1c({ ... });` ブロックを削除。
- `<html className={...}>` から `${mPlusRounded.variable} ` を除去。

- [ ] **Step 3: 型・lint・テスト・ビルド**

Run: `npm run typecheck && npm run lint && npm run test:run && npm run build`
Expected: すべて成功（見出しは Zen Maru Gothic のまま）。

- [ ] **Step 4: コミット**

```bash
git add app/layout.tsx
git commit -m "$(printf 'chore: 未使用の M PLUS Rounded フォント読込を削除\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 8: AnimatedNumber の値変更・クリーンアップのテストを追加

波0で未カバーだった「初回マウント後に value が変わったとき前回値から補間する」経路と rAF クリーンアップを検証する（波0最終レビューの繰り越し Minor）。

**Files:**
- Modify: `components/shared/animated-number.test.tsx`

**Interfaces:**
- Consumes: `AnimatedNumber`（既存）。

- [ ] **Step 1: 値変更テストを追加**

`components/shared/animated-number.test.tsx` の `describe("AnimatedNumber", ...)` 内に次を追加する（既存テストは変更しない）:

```tsx
  it("value 変更時は前回値から新しい値へ補間する", () => {
    forceReducedMotion(false);
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(
      (cb: FrameRequestCallback) => {
        frames.push(cb);
        return frames.length;
      },
    );
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    const { rerender } = render(
      <AnimatedNumber value={100} durationMs={100} format={(n) => String(Math.round(n))} />,
    );
    // 初回アニメーションを完了させ、表示を 100 に収束させる。
    now = 100;
    act(() => {
      frames.shift()?.(now);
    });
    expect(screen.getByText("100")).toBeInTheDocument();

    // value を 200 に変更 → 0 ではなく 100 から補間する。
    frames.length = 0;
    rerender(
      <AnimatedNumber value={200} durationMs={100} format={(n) => String(Math.round(n))} />,
    );
    now = 150; // 変更後フレームの開始 now=100, t=0.5
    act(() => {
      frames.shift()?.(now);
    });
    // t=0.5, eased=0.875: 100 + (200-100)*0.875 = 187.5 -> 188（0 起点なら 88 になるはず）。
    expect(screen.getByText("188")).toBeInTheDocument();
  });

  it("アンマウント時に rAF をキャンセルする", () => {
    forceReducedMotion(false);
    vi.spyOn(performance, "now").mockReturnValue(0);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    const cancel = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => {});

    const { unmount } = render(<AnimatedNumber value={50} durationMs={100} />);
    unmount();
    expect(cancel).toHaveBeenCalled();
  });
```

注: `rerender` / `act` / `unmount` は `@testing-library/react` から得られる（`render(...)` の戻り値、および既存 import の `act`）。既存テストが `act` を import 済みであることを前提とする。未 import の場合は `import { act, render, screen } from "@testing-library/react";` に補う。

- [ ] **Step 2: テスト実行**

Run: `npm run test:run -- animated-number`
Expected: 既存2件＋新規2件＝4 tests PASS。`188` が出ず別の値（例: `88`）になった場合、それは「前回値からの補間」になっていない回帰なので STOP して報告（実装は波0で正しいはずなので、その場合はテスト期待値ではなく実装側の確認が必要）。

- [ ] **Step 3: 全テスト確認**

Run: `npm run test:run`
Expected: 全 PASS。

- [ ] **Step 4: コミット**

```bash
git add components/shared/animated-number.test.tsx
git commit -m "$(printf 'test: AnimatedNumber の値変更・クリーンアップ経路を検証\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## 波1 完了チェック

- [ ] `npm run typecheck` / `npm run lint` PASS
- [ ] `npm run test:run` 全 PASS
- [ ] `npm run build` 成功
- [ ] `npm run test:e2e -- dashboard transactions analytics` PASS（または主要3スペック個別 PASS）
- [ ] dev サーバーで 3画面をライト/ダーク両方で目視（PageHeader/SectionHeading/Surface/Amount/KpiRibbon が反映、最上部・節見出し・カード面・金額・KPI が他画面と一致、reduced-motion で静止）

波1完了後、波2（categories / members / settings / help / household）の計画を別途作成する。
