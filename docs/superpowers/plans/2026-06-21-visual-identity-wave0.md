# ビジュアル統一 波0（土台）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 「やわらかな家計のリビング」アイデンティティの土台（デザイントークン・Zen Maru Gothic・共通プリミティブ群）を実装し、全ページが使える状態にする。

**Architecture:** `globals.css` にサーフェス階層・ふっくら影・グレイン/呼吸の演出トークンを追加し、`next/font` で見出しを Zen Maru Gothic に差し替える。世界観を閉じ込めた再利用部品を `components/shared/` に新設（各々ユニットテスト付き）。`AmbientBackground` をルートレイアウトにマウントして全画面に光と質感を敷く。波1以降は本波の部品を各ページへ適用する。

**Tech Stack:** Next.js App Router / TypeScript / Tailwind CSS v4 / shadcn/ui / Vitest + React Testing Library / lucide-react

## Global Constraints

- `components/ui/`（shadcn）は直接編集しない。世界観は globals.css と `components/shared/` で作る。
- 機能・URL・データ挙動は不変（見た目とマークアップのみ）。
- 既存テスト（300件）を壊さない。文言・`data-testid` を変える場合のみ該当テストを更新。
- ライト/ダーク両対応を維持。すべての動きは `prefers-reduced-motion: reduce` で停止/無効。
- テストは co-located（`components/shared/foo.tsx` ↔ `components/shared/foo.test.tsx`）。
- import エイリアスは `@/`。コミットメッセージは `<type>: <日本語説明>` 形式＋末尾に `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。
- 検証コマンド: `npm run test:run` / `npm run typecheck` / `npm run lint`。

---

### Task 1: 見出しフォントを Zen Maru Gothic に差し替え

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css:12`（`--font-heading` の定義）

**Interfaces:**
- Produces: CSS 変数 `--font-zen-maru`（`<html>` に付与）、`--font-heading` が Zen Maru Gothic を指す。

- [ ] **Step 1: フォントを読み込み `<html>` に変数を付与**

`app/layout.tsx` を編集する。import 行に追加:

```tsx
import { Geist_Mono, M_PLUS_Rounded_1c, Noto_Sans_JP, Zen_Maru_Gothic } from "next/font/google";
```

`geistMono` の定義の直後に追加:

```tsx
const zenMaruGothic = Zen_Maru_Gothic({
  variable: "--font-zen-maru",
  weight: ["500", "700"],
  subsets: ["latin"],
});
```

`<html className=...>` を更新（`zenMaruGothic.variable` を追加）:

```tsx
className={`${notoSansJP.variable} ${mPlusRounded.variable} ${zenMaruGothic.variable} ${geistMono.variable} h-full antialiased`}
```

- [ ] **Step 2: `--font-heading` を差し替え**

`app/globals.css` の `@theme inline` 内、現在の `--font-heading: var(--font-mplus-rounded);`（12行目付近）を次に変更:

```css
  --font-heading: var(--font-zen-maru);
```

- [ ] **Step 3: 型チェックとテストが壊れていないことを確認**

Run: `npm run typecheck && npm run test:run`
Expected: typecheck PASS / Tests 300 passed

- [ ] **Step 4: コミット**

```bash
git add app/layout.tsx app/globals.css
git commit -m "$(printf 'feat: 見出しフォントを Zen Maru Gothic に変更\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 2: デザイントークン（サーフェス階層・ふっくら影・呼吸）を追加

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Produces: Tailwind ユーティリティ `bg-surface-sunken` / `text-accent-warm` / `bg-accent-warm`、CSS 変数 `--shadow-pillow` / `--shadow-inset`、`@keyframes breathe`。

- [ ] **Step 1: `@theme inline` にカラー/影トークンを追加**

`app/globals.css` の `@theme inline { ... }` 内、`--shadow-lifted: ...;` ブロックの直後に追加:

```css
  --color-surface-sunken: var(--surface-sunken);
  --color-accent-warm: var(--accent-warm);
  --color-accent-warm-foreground: var(--accent-warm-foreground);
  --shadow-pillow:
    0 1px 1px oklch(0.35 0.05 145 / 0.04),
    0 6px 16px -4px oklch(0.35 0.05 145 / 0.1),
    0 20px 40px -12px oklch(0.35 0.05 145 / 0.14);
  --shadow-inset: inset 0 1px 3px oklch(0.35 0.05 145 / 0.1);
```

- [ ] **Step 2: `:root`（ライト）に変数値を追加**

`:root { ... }` 内、`--accent: ...;` の直後に追加:

```css
  --surface-sunken: oklch(0.955 0.018 88);
  --accent-warm: oklch(0.83 0.1 70);
  --accent-warm-foreground: oklch(0.38 0.07 60);
```

- [ ] **Step 3: `.dark` に変数値を追加**

`.dark { ... }` 内、`--accent: ...;` の直後に追加:

```css
  --surface-sunken: oklch(0.25 0.02 150);
  --accent-warm: oklch(0.78 0.1 70);
  --accent-warm-foreground: oklch(0.22 0.03 60);
```

- [ ] **Step 4: 呼吸アニメの keyframes を追加**

`app/globals.css` 末尾（`@media (prefers-reduced-motion: reduce)` ブロックの直前）に追加:

```css
/* アンビエント背景グローのゆっくりした呼吸。 */
@keyframes breathe {
  0%,
  100% {
    opacity: 0.5;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.06);
  }
}
```

- [ ] **Step 5: ビルドが通ることを確認**

Run: `npm run build`
Expected: ビルド成功（エラーなし）。

- [ ] **Step 6: コミット**

```bash
git add app/globals.css
git commit -m "$(printf 'feat: サーフェス階層・ふっくら影・呼吸のデザイントークンを追加\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 3: `AnimatedNumber`（数字カウントアップ）

**Files:**
- Create: `components/shared/animated-number.tsx`
- Test: `components/shared/animated-number.test.tsx`

**Interfaces:**
- Produces: `AnimatedNumber({ value: number; format?: (n: number) => string; durationMs?: number; className?: string })` — クライアントコンポーネント。reduced-motion 時は即値表示。

- [ ] **Step 1: 失敗するテストを書く**

`components/shared/animated-number.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AnimatedNumber } from "./animated-number";

afterEach(() => {
  vi.restoreAllMocks();
});

/** reduced-motion を強制するため matchMedia を上書きする。 */
function forceReducedMotion(reduced: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: reduced,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}

describe("AnimatedNumber", () => {
  it("reduced-motion では最終値を即時表示する", () => {
    forceReducedMotion(true);
    render(<AnimatedNumber value={1234} format={(n) => `¥${Math.round(n)}`} />);
    expect(screen.getByText("¥1234")).toBeInTheDocument();
  });

  it("アニメーション後に最終値を表示する", async () => {
    forceReducedMotion(false);
    render(
      <AnimatedNumber value={500} durationMs={30} format={(n) => `${Math.round(n)}`} />,
    );
    expect(await screen.findByText("500")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test:run -- animated-number`
Expected: FAIL（モジュール `./animated-number` が存在しない）。

- [ ] **Step 3: 最小実装を書く**

`components/shared/animated-number.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: number;
  /** 表示整形。既定は整数丸め。通貨は format={yen} を渡す。 */
  format?: (n: number) => string;
  durationMs?: number;
  className?: string;
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** value へ向けてカウントアップする数値。reduced-motion 時は即時表示。 */
export function AnimatedNumber({
  value,
  format = (n) => String(Math.round(n)),
  durationMs = 700,
  className,
}: Props) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return <span className={className}>{format(display)}</span>;
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test:run -- animated-number`
Expected: PASS（2 tests）。

- [ ] **Step 5: コミット**

```bash
git add components/shared/animated-number.tsx components/shared/animated-number.test.tsx
git commit -m "$(printf 'feat: 数字カウントアップ AnimatedNumber を追加\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 4: `Amount`（金額表示）

**Files:**
- Create: `components/shared/amount.tsx`
- Test: `components/shared/amount.test.tsx`

**Interfaces:**
- Consumes: `yen` from `@/lib/format`、`cn` from `@/lib/utils`。
- Produces: `Amount({ value: number; type: "income" | "expense"; showSign?: boolean; className?: string })`。

- [ ] **Step 1: 失敗するテストを書く**

`components/shared/amount.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Amount } from "./amount";

describe("Amount", () => {
  it("収入は + 符号と income 色で表示する", () => {
    render(<Amount value={1000} type="income" />);
    const el = screen.getByText("+¥1,000");
    expect(el).toHaveClass("text-income");
  });

  it("支出は - 符号と expense 色で表示する", () => {
    render(<Amount value={500} type="expense" />);
    const el = screen.getByText("-¥500");
    expect(el).toHaveClass("text-expense");
  });

  it("showSign=false なら符号を出さない", () => {
    render(<Amount value={500} type="expense" showSign={false} />);
    expect(screen.getByText("¥500")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test:run -- amount`
Expected: FAIL（モジュール未作成）。

- [ ] **Step 3: 最小実装を書く**

`components/shared/amount.tsx`:

```tsx
import { yen } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  value: number;
  type: "income" | "expense";
  /** 既定 true。先頭に +/- を付ける。 */
  showSign?: boolean;
  className?: string;
};

/** 収支金額を符号・色・等幅で一元表示する。 */
export function Amount({ value, type, showSign = true, className }: Props) {
  const sign = showSign ? (type === "income" ? "+" : "-") : "";
  return (
    <span
      className={cn(
        "font-heading font-bold tabular-nums",
        type === "income" ? "text-income" : "text-expense",
        className,
      )}
    >
      {sign}
      {yen(value)}
    </span>
  );
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test:run -- amount`
Expected: PASS（3 tests）。

- [ ] **Step 5: コミット**

```bash
git add components/shared/amount.tsx components/shared/amount.test.tsx
git commit -m "$(printf 'feat: 金額表示 Amount を追加\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 5: `IconChip`（丸アイコンチップ）

**Files:**
- Create: `components/shared/icon-chip.tsx`
- Test: `components/shared/icon-chip.test.tsx`

**Interfaces:**
- Consumes: `LucideIcon` type from `lucide-react`、`cn`。
- Produces: `IconChip({ icon: LucideIcon; label?: string; tone?: "income" | "expense" | "neutral"; className?: string })`。

- [ ] **Step 1: 失敗するテストを書く**

`components/shared/icon-chip.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { PiggyBank } from "lucide-react";
import { describe, expect, it } from "vitest";

import { IconChip } from "./icon-chip";

describe("IconChip", () => {
  it("label を aria ラベルとして公開する", () => {
    render(<IconChip icon={PiggyBank} label="貯蓄" />);
    expect(screen.getByLabelText("貯蓄")).toBeInTheDocument();
  });

  it("tone=income で income 配色クラスを付ける", () => {
    render(<IconChip icon={PiggyBank} label="収入" tone="income" />);
    expect(screen.getByLabelText("収入")).toHaveClass("text-income");
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test:run -- icon-chip`
Expected: FAIL（モジュール未作成）。

- [ ] **Step 3: 最小実装を書く**

`components/shared/icon-chip.tsx`:

```tsx
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type Tone = "income" | "expense" | "neutral";

type Props = {
  icon: LucideIcon;
  label?: string;
  tone?: Tone;
  className?: string;
};

const TONES: Record<Tone, string> = {
  income: "bg-income-soft text-income",
  expense: "bg-expense-soft text-expense",
  neutral: "bg-secondary text-secondary-foreground",
};

/** 丸い背景にアイコンを載せた小さなチップ。 */
export function IconChip({ icon: Icon, label, tone = "neutral", className }: Props) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full",
        TONES[tone],
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

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test:run -- icon-chip`
Expected: PASS（2 tests）。

- [ ] **Step 5: コミット**

```bash
git add components/shared/icon-chip.tsx components/shared/icon-chip.test.tsx
git commit -m "$(printf 'feat: 丸アイコンチップ IconChip を追加\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 6: `Surface`（マテリアルなカード面）

**Files:**
- Create: `components/shared/surface.tsx`
- Test: `components/shared/surface.test.tsx`

**Interfaces:**
- Consumes: `Card` from `@/components/ui/card`、`cn`、Task 2 の `--shadow-pillow` / `--shadow-inset` / `bg-surface-sunken`。
- Produces: `Surface(props: React.ComponentProps<typeof Card> & { variant?: "raised" | "sunken" | "flat" })`。`Card` の `data-slot="card"` を保持。

- [ ] **Step 1: 失敗するテストを書く**

`components/shared/surface.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Surface } from "./surface";

describe("Surface", () => {
  it("子要素を描画する", () => {
    render(<Surface>中身</Surface>);
    expect(screen.getByText("中身")).toBeInTheDocument();
  });

  it("raised バリアントで pillow 影クラスを付ける", () => {
    render(<Surface variant="raised">x</Surface>);
    const card = screen.getByText("x").closest('[data-slot="card"]');
    expect(card).toHaveClass("shadow-[var(--shadow-pillow)]");
  });

  it("sunken バリアントで sunken 背景クラスを付ける", () => {
    render(<Surface variant="sunken">y</Surface>);
    const card = screen.getByText("y").closest('[data-slot="card"]');
    expect(card).toHaveClass("bg-surface-sunken");
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test:run -- surface`
Expected: FAIL（モジュール未作成）。

- [ ] **Step 3: 最小実装を書く**

`components/shared/surface.tsx`:

```tsx
import * as React from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Variant = "raised" | "sunken" | "flat";

type Props = React.ComponentProps<typeof Card> & { variant?: Variant };

const VARIANTS: Record<Variant, string> = {
  raised: "shadow-[var(--shadow-pillow)] ring-0",
  sunken: "bg-surface-sunken shadow-[var(--shadow-inset)] ring-1 ring-foreground/5",
  flat: "shadow-none ring-1 ring-foreground/10",
};

/** shadcn Card にマテリアルな質感（pillow/inset）を与えるラッパー。 */
export function Surface({ variant = "raised", className, ...props }: Props) {
  return <Card className={cn(VARIANTS[variant], className)} {...props} />;
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test:run -- surface`
Expected: PASS（3 tests）。

- [ ] **Step 5: コミット**

```bash
git add components/shared/surface.tsx components/shared/surface.test.tsx
git commit -m "$(printf 'feat: マテリアルなカード面 Surface を追加\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 7: `SectionHeading`（節見出し）

**Files:**
- Create: `components/shared/section-heading.tsx`
- Test: `components/shared/section-heading.test.tsx`

**Interfaces:**
- Consumes: `cn`。
- Produces: `SectionHeading({ children: React.ReactNode; index?: number; className?: string })` — `<h2>` を描画。

- [ ] **Step 1: 失敗するテストを書く**

`components/shared/section-heading.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SectionHeading } from "./section-heading";

describe("SectionHeading", () => {
  it("見出しを h2 として描画する", () => {
    render(<SectionHeading>カテゴリ別支出</SectionHeading>);
    expect(
      screen.getByRole("heading", { level: 2, name: "カテゴリ別支出" }),
    ).toBeInTheDocument();
  });

  it("index を2桁ゼロ詰めで表示する", () => {
    render(<SectionHeading index={1}>x</SectionHeading>);
    expect(screen.getByText("01")).toBeInTheDocument();
  });

  it("index 未指定なら番号を出さない", () => {
    render(<SectionHeading>x</SectionHeading>);
    expect(screen.queryByText("01")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test:run -- section-heading`
Expected: FAIL（モジュール未作成）。

- [ ] **Step 3: 最小実装を書く**

`components/shared/section-heading.tsx`:

```tsx
import * as React from "react";

import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  /** 渡すと "01" のような番号を先頭に表示する。 */
  index?: number;
  className?: string;
};

/** 番号・見出し・ヘアライン罫を並べた節見出し。 */
export function SectionHeading({ children, index, className }: Props) {
  return (
    <div className={cn("mb-2 flex items-end gap-3", className)}>
      {index !== undefined ? (
        <span className="font-heading text-xs font-bold tabular-nums text-primary">
          {String(index).padStart(2, "0")}
        </span>
      ) : null}
      <h2 className="font-heading text-base font-bold">{children}</h2>
      <span className="mb-1.5 h-px flex-1 bg-border/70" aria-hidden />
    </div>
  );
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test:run -- section-heading`
Expected: PASS（3 tests）。

- [ ] **Step 5: コミット**

```bash
git add components/shared/section-heading.tsx components/shared/section-heading.test.tsx
git commit -m "$(printf 'feat: 節見出し SectionHeading を追加\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 8: `PageHeader`（最上部の統一見出し）

**Files:**
- Create: `components/shared/page-header.tsx`
- Test: `components/shared/page-header.test.tsx`

**Interfaces:**
- Consumes: `cn`。
- Produces: `PageHeader({ eyebrow?: string; title: string; actions?: React.ReactNode; className?: string })` — `<h1>` を描画。

- [ ] **Step 1: 失敗するテストを書く**

`components/shared/page-header.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "./page-header";

describe("PageHeader", () => {
  it("タイトルを h1 として描画する", () => {
    render(<PageHeader title="ダッシュボード" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "ダッシュボード" }),
    ).toBeInTheDocument();
  });

  it("eyebrow と actions を描画する", () => {
    render(
      <PageHeader
        eyebrow="ホーム"
        title="ダッシュボード"
        actions={<button>記録する</button>}
      />,
    );
    expect(screen.getByText("ホーム")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "記録する" }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test:run -- page-header`
Expected: FAIL（モジュール未作成）。

- [ ] **Step 3: 最小実装を書く**

`components/shared/page-header.tsx`:

```tsx
import * as React from "react";

import { cn } from "@/lib/utils";

type Props = {
  /** 英字トラッキングの小見出し（任意）。 */
  eyebrow?: string;
  title: string;
  /** 右側に並べる操作（任意）。 */
  actions?: React.ReactNode;
  className?: string;
};

/** 全ページ共通の最上部見出し（eyebrow + タイトル + 操作スロット）。 */
export function PageHeader({ eyebrow, title, actions, className }: Props) {
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
      </div>
      {actions ? (
        <div className="flex items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test:run -- page-header`
Expected: PASS（2 tests）。

- [ ] **Step 5: コミット**

```bash
git add components/shared/page-header.tsx components/shared/page-header.test.tsx
git commit -m "$(printf 'feat: 共通の最上部見出し PageHeader を追加\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 9: `StatTile`（アイコン付き数値タイル）

**Files:**
- Create: `components/shared/stat-tile.tsx`
- Test: `components/shared/stat-tile.test.tsx`

**Interfaces:**
- Consumes: Task 3 `AnimatedNumber`、Task 5 `IconChip`、`LucideIcon` type、`cn`。
- Produces: `StatTile({ label: string; value: number; format?: (n: number) => string; icon?: LucideIcon; tone?: "income" | "expense" | "neutral"; className?: string })`。

- [ ] **Step 1: 失敗するテストを書く**

`components/shared/stat-tile.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { TrendingUp } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StatTile } from "./stat-tile";

afterEach(() => {
  vi.restoreAllMocks();
});

/** AnimatedNumber を即値表示にするため reduced-motion を強制する。 */
function forceReducedMotion() {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: true,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}

describe("StatTile", () => {
  it("ラベルと整形済みの値を表示する", () => {
    forceReducedMotion();
    render(
      <StatTile
        label="収入"
        value={1000}
        icon={TrendingUp}
        tone="income"
        format={(n) => `¥${Math.round(n)}`}
      />,
    );
    expect(screen.getByText("収入")).toBeInTheDocument();
    expect(screen.getByText("¥1000")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test:run -- stat-tile`
Expected: FAIL（モジュール未作成）。

- [ ] **Step 3: 最小実装を書く**

`components/shared/stat-tile.tsx`:

```tsx
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { AnimatedNumber } from "./animated-number";
import { IconChip } from "./icon-chip";

type Tone = "income" | "expense" | "neutral";

type Props = {
  label: string;
  value: number;
  format?: (n: number) => string;
  icon?: LucideIcon;
  tone?: Tone;
  className?: string;
};

const VALUE_TONE: Record<Tone, string> = {
  income: "text-income",
  expense: "text-expense",
  neutral: "text-foreground",
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
          VALUE_TONE[tone],
        )}
      />
    </div>
  );
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test:run -- stat-tile`
Expected: PASS（1 test）。

- [ ] **Step 5: コミット**

```bash
git add components/shared/stat-tile.tsx components/shared/stat-tile.test.tsx
git commit -m "$(printf 'feat: 数値タイル StatTile を追加\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 10: `KpiRibbon`（フルブリードな KPI リボン）

**Files:**
- Create: `components/shared/kpi-ribbon.tsx`
- Test: `components/shared/kpi-ribbon.test.tsx`

**Interfaces:**
- Consumes: Task 6 `Surface`、Task 3 `AnimatedNumber`、`CardContent` from `@/components/ui/card`、`cn`。
- Produces: `KpiRibbon({ items: { label: string; value: number; format?: (n: number) => string; unit?: string }[]; className?: string })`。カード端いっぱい（フルブリード）でセル間ヘアライン、角の崩れを起こさない構成。

- [ ] **Step 1: 失敗するテストを書く**

`components/shared/kpi-ribbon.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { KpiRibbon } from "./kpi-ribbon";

afterEach(() => {
  vi.restoreAllMocks();
});

function forceReducedMotion() {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: true,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}

describe("KpiRibbon", () => {
  it("全項目のラベルと値・単位を表示する", () => {
    forceReducedMotion();
    render(
      <KpiRibbon
        items={[
          { label: "当期収入", value: 1000, format: (n) => `¥${Math.round(n)}` },
          { label: "支出カテゴリ", value: 11, unit: "件" },
        ]}
      />,
    );
    expect(screen.getByText("当期収入")).toBeInTheDocument();
    expect(screen.getByText("¥1000")).toBeInTheDocument();
    expect(screen.getByText("支出カテゴリ")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();
    expect(screen.getByText("件")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test:run -- kpi-ribbon`
Expected: FAIL（モジュール未作成）。

- [ ] **Step 3: 最小実装を書く**

`components/shared/kpi-ribbon.tsx`:

```tsx
import { CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { AnimatedNumber } from "./animated-number";
import { Surface } from "./surface";

type Kpi = {
  label: string;
  value: number;
  format?: (n: number) => string;
  unit?: string;
};

type Props = {
  items: Kpi[];
  className?: string;
};

/** 数値KPIをカード端いっぱいに並べ、セル間をヘアラインで仕切るリボン。 */
export function KpiRibbon({ items, className }: Props) {
  return (
    <Surface
      variant="raised"
      className={cn("relative overflow-hidden py-0", className)}
    >
      <CardContent className="grid grid-cols-2 gap-px bg-border/60 px-0 sm:grid-cols-4">
        {items.map((kpi) => (
          <div key={kpi.label} className="flex flex-col gap-1 bg-card p-4 sm:p-5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {kpi.label}
            </span>
            <span className="font-heading text-2xl font-bold tabular-nums">
              <AnimatedNumber value={kpi.value} format={kpi.format} />
              {kpi.unit ? (
                <span className="ml-0.5 text-sm text-muted-foreground">
                  {kpi.unit}
                </span>
              ) : null}
            </span>
          </div>
        ))}
      </CardContent>
    </Surface>
  );
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test:run -- kpi-ribbon`
Expected: PASS（1 test）。

- [ ] **Step 5: コミット**

```bash
git add components/shared/kpi-ribbon.tsx components/shared/kpi-ribbon.test.tsx
git commit -m "$(printf 'feat: フルブリードな KPI リボン KpiRibbon を追加\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 11: `AmbientBackground` を実装しルートにマウント

**Files:**
- Create: `components/shared/ambient-background.tsx`
- Test: `components/shared/ambient-background.test.tsx`
- Modify: `app/layout.tsx`（マウント）
- Modify: `app/globals.css`（body の放射グラデーション背景を削除し、ベース色のみ残す）

**Interfaces:**
- Consumes: Task 2 の `bg-accent` / `bg-accent-warm` / `@keyframes breathe`。
- Produces: `AmbientBackground()` — `aria-hidden` の固定装飾レイヤー（呼吸グロー＋極薄グレイン）。

- [ ] **Step 1: 失敗するテストを書く**

`components/shared/ambient-background.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AmbientBackground } from "./ambient-background";

describe("AmbientBackground", () => {
  it("装飾レイヤーを aria-hidden / pointer-events-none で描画する", () => {
    const { container } = render(<AmbientBackground />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).not.toBeNull();
    expect(root).toHaveAttribute("aria-hidden");
    expect(root).toHaveClass("pointer-events-none");
    expect(root).toHaveClass("fixed");
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm run test:run -- ambient-background`
Expected: FAIL（モジュール未作成）。

- [ ] **Step 3: 最小実装を書く**

`components/shared/ambient-background.tsx`:

```tsx
/**
 * 全画面に敷く装飾レイヤー。ゆっくり呼吸するグロー2つと極薄グレインを重ね、
 * クリーム/深緑のベースに光と質感を与える。動きは motion-safe のみ。
 */
const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function AmbientBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute -right-[10%] -top-[15%] size-[45rem] rounded-full bg-accent/40 blur-3xl motion-safe:animate-[breathe_18s_ease-in-out_infinite]" />
      <div className="absolute -left-[15%] top-[25%] size-[38rem] rounded-full bg-accent-warm/25 blur-3xl motion-safe:animate-[breathe_22s_ease-in-out_infinite]" />
      <div
        className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06]"
        style={{ backgroundImage: NOISE, backgroundSize: "120px 120px" }}
      />
    </div>
  );
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm run test:run -- ambient-background`
Expected: PASS（1 test）。

- [ ] **Step 5: ルートレイアウトにマウント**

`app/layout.tsx` の import に追加:

```tsx
import { AmbientBackground } from "@/components/shared/ambient-background";
```

`<body ...>` の先頭（`<ThemeProvider>` の中、`{children}` の前）に追加:

```tsx
        <ThemeProvider>
          <AmbientBackground />
          {children}
          <Toaster />
        </ThemeProvider>
```

- [ ] **Step 6: body のグラデーション背景を削除（重複防止）**

`app/globals.css` の `@layer base` 内 `body { ... }` を、グローを `AmbientBackground` に移したので次に簡素化する:

```css
  body {
    @apply bg-background text-foreground;
  }
```

そして不要になった `.dark body { background-image: ...; }` ブロックを削除する。

- [ ] **Step 7: 型・テスト・ビルドを確認**

Run: `npm run typecheck && npm run test:run && npm run build`
Expected: typecheck PASS / Tests 全 PASS / build 成功。

- [ ] **Step 8: コミット**

```bash
git add components/shared/ambient-background.tsx components/shared/ambient-background.test.tsx app/layout.tsx app/globals.css
git commit -m "$(printf 'feat: 全画面の装飾レイヤー AmbientBackground を追加しルートに敷く\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 12: 共通シェルのマテリアル化

**Files:**
- Modify: `components/features/layout/app-header.tsx`

**Interfaces:**
- Consumes: Task 2 の `--shadow-pillow`。
- Produces: なし（見た目のみ）。既存の `app-header.test.tsx` は挙動テストのため変更不要。

- [ ] **Step 1: 既存テストが緑であることを確認（基準）**

Run: `npm run test:run -- app-header`
Expected: PASS（既存テスト）。

- [ ] **Step 2: ユーザーメニュー トリガーをふっくら影に**

`components/features/layout/app-header.tsx` の `DropdownMenuTrigger` の className 内、`shadow-soft` を `shadow-[var(--shadow-pillow)]` に置換する:

```tsx
            className="flex items-center gap-2 rounded-full border border-border/70 bg-card py-1 pl-1 pr-3 text-sm shadow-[var(--shadow-pillow)] transition-colors hover:bg-accent/60"
```

- [ ] **Step 3: ロゴと「収支を記録」ボタンのふっくら影に**

同ファイル、ロゴの `ShalletLogo` の className 内 `shadow-soft` と、「収支を記録」`Link` の className 内 `shadow-soft` をそれぞれ `shadow-[var(--shadow-pillow)]` に置換する。

- [ ] **Step 4: 型・lint・テストを確認**

Run: `npm run typecheck && npm run lint && npm run test:run -- app-header`
Expected: いずれも PASS。

- [ ] **Step 5: コミット**

```bash
git add components/features/layout/app-header.tsx
git commit -m "$(printf 'feat: 共通ヘッダーをふっくら影でマテリアル化\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## 波0 完了チェック

- [ ] `npm run typecheck` PASS
- [ ] `npm run lint` PASS
- [ ] `npm run test:run` 全 PASS（既存300件＋新規プリミティブのテスト）
- [ ] `npm run build` 成功
- [ ] dev サーバーで主要画面をライト/ダーク両方で目視（背景の呼吸グロー・グレイン・ふっくら影が出ている / reduced-motion で静止する）

波0完了後、波1（dashboard / transactions / analytics への適用）の計画を別途作成する。
```
