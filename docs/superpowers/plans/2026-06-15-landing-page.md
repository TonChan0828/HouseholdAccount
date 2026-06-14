# ランディングページ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 公開トップ `/` にランディングページを新設し、ダッシュボード本体を `/dashboard` へ移動する。

**Architecture:** `/` をルートレイアウトのみで描画する公開LPにする。LP は `components/features/landing/` 配下の純粋表示コンポーネントを `app/page.tsx` で組み立てる。ルーティング制御は `lib/route-access.ts` のパス判定純粋関数 + `lib/supabase/middleware.ts` で行う。ダッシュボード index は `app/(dashboard)/dashboard/page.tsx` へ移動し、アプリ内の `/` 参照を `/dashboard` に張り替える。

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, lucide-react, Vitest + React Testing Library, Playwright。仕様書: `docs/specs/12_landing_page.md`。

---

## ファイル構成

**新規作成**
- `lib/route-access.ts` — パス公開判定の純粋関数
- `lib/route-access.test.ts` — 上記のユニットテスト
- `app/page.tsx` — 公開ランディングページ（組み立て）
- `components/features/landing/landing-header.tsx`
- `components/features/landing/landing-header.test.tsx`
- `components/features/landing/hero.tsx`
- `components/features/landing/hero.test.tsx`
- `components/features/landing/feature-bento.tsx`
- `components/features/landing/feature-bento.test.tsx`
- `components/features/landing/steps.tsx`
- `components/features/landing/steps.test.tsx`
- `components/features/landing/final-cta.tsx`
- `components/features/landing/final-cta.test.tsx`
- `components/features/landing/landing-footer.tsx`
- `components/features/landing/landing-footer.test.tsx`

**移動**
- `app/(dashboard)/page.tsx` → `app/(dashboard)/dashboard/page.tsx`

**修正**
- `lib/supabase/middleware.ts` — `isPublicPath` を `lib/route-access` に委譲、ログイン済み `/` → `/households`
- `components/features/layout/nav-items.ts` — ホーム href / isNavActive を `/dashboard` に
- `components/features/layout/nav-items.test.ts`
- `components/features/layout/mobile-tab-bar.test.tsx`
- `components/features/layout/app-header.tsx:37` — ロゴ href → `/dashboard`
- `app/households/actions.ts:60,229` — `redirect("/")` → `redirect("/dashboard")`
- E2E: `e2e/auth.spec.ts`, `e2e/transactions.spec.ts`, `e2e/members.spec.ts`, `e2e/household.spec.ts`, `e2e/categories.spec.ts`, `e2e/analytics.spec.ts`, `e2e/settings.spec.ts`, `e2e/dashboard.spec.ts`, `e2e/theme.spec.ts`

---

## Task 1: パス公開判定の純粋関数

**Files:**
- Create: `lib/route-access.ts`
- Test: `lib/route-access.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`lib/route-access.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { isPublicPath } from "./route-access";

describe("isPublicPath", () => {
  it("ルート / は公開", () => {
    expect(isPublicPath("/")).toBe(true);
  });

  it("/login・/register・/auth 配下は公開", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/register")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
  });

  it("ダッシュボード・保護ルートは非公開", () => {
    expect(isPublicPath("/dashboard")).toBe(false);
    expect(isPublicPath("/transactions")).toBe(false);
    expect(isPublicPath("/households")).toBe(false);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test:run -- lib/route-access.test.ts`
Expected: FAIL（`isPublicPath` が未定義）

- [ ] **Step 3: 最小実装**

`lib/route-access.ts`:

```typescript
/** 認証不要（未ログインでもアクセス可）なパスの接頭辞 */
const PUBLIC_PATH_PREFIXES = ["/login", "/register", "/auth"];

/**
 * 未ログインでもアクセスできるパスかを判定する。
 * `/`（ランディングページ）は完全一致で公開、それ以外は接頭辞一致で判定する。
 */
export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") {
    return true;
  }
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test:run -- lib/route-access.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add lib/route-access.ts lib/route-access.test.ts
git commit -m "feat: 公開パス判定の純粋関数を追加"
```

---

## Task 2: middleware を更新（/ を公開・ログイン済みは /households へ）

**Files:**
- Modify: `lib/supabase/middleware.ts`

- [ ] **Step 1: `isPublicPath` を route-access に委譲し、ログイン済み `/` のリダイレクトを追加**

`lib/supabase/middleware.ts` の冒頭 import に追加し、ローカル定義の `PUBLIC_PATH_PREFIXES` と `isPublicPath` を削除する。

import 追加（既存の import 群の末尾に）:

```typescript
import { isPublicPath } from "@/lib/route-access";
```

削除する既存コード（7〜12行目相当）:

```typescript
/** 認証不要（未ログインでもアクセス可）なパスの接頭辞 */
const PUBLIC_PATH_PREFIXES = ["/login", "/register", "/auth"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
```

`const { pathname } = request.nextUrl;` の後、既存の「未ログインで保護ルート」チェックの前に、ログイン済み `/` のリダイレクトを追加する。最終的な分岐は次の順序になる:

```typescript
  const { pathname } = request.nextUrl;

  // ログイン済みでランディングページに来たらグループ選択へ
  if (user && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/households";
    return NextResponse.redirect(url);
  }

  // 未ログインで保護ルートにアクセス → ログインへ
  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // ログイン済みで認証ページにアクセス → グループ選択へ
  if (user && (pathname.startsWith("/login") || pathname.startsWith("/register"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/households";
    return NextResponse.redirect(url);
  }
```

- [ ] **Step 2: 型チェックと既存テストが通ることを確認**

Run: `npm run typecheck && npm run test:run -- lib/route-access.test.ts`
Expected: PASS（型エラーなし）

- [ ] **Step 3: コミット**

```bash
git add lib/supabase/middleware.ts
git commit -m "feat: / を公開しログイン済みは /households へ誘導するよう middleware を更新"
```

---

## Task 3: ダッシュボードを /dashboard へ移動

**Files:**
- Move: `app/(dashboard)/page.tsx` → `app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: ファイルを git mv で移動**

```bash
mkdir -p "app/(dashboard)/dashboard"
git mv "app/(dashboard)/page.tsx" "app/(dashboard)/dashboard/page.tsx"
```

ファイル内容は変更しない（相対 import は無いため移動だけで動作する。`@/` エイリアス import のみ）。

- [ ] **Step 2: 型チェック**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: コミット**

```bash
git add -A
git commit -m "refactor: ダッシュボード index を /dashboard へ移動"
```

---

## Task 4: アプリ内ナビの / 参照を /dashboard に張り替え

**Files:**
- Modify: `components/features/layout/nav-items.ts`
- Modify: `components/features/layout/nav-items.test.ts`
- Modify: `components/features/layout/mobile-tab-bar.test.tsx`
- Modify: `components/features/layout/app-header.tsx`
- Modify: `app/households/actions.ts`

- [ ] **Step 1: テストを先に更新（Red）**

`components/features/layout/nav-items.test.ts` を以下に更新:

```typescript
import { describe, expect, it } from "vitest";

import { NAV_ITEMS, isNavActive } from "./nav-items";

describe("NAV_ITEMS", () => {
  it("主要5ページへのリンクを定義する", () => {
    expect(NAV_ITEMS.map((i) => i.href)).toEqual([
      "/dashboard",
      "/transactions",
      "/analytics",
      "/members",
      "/categories",
    ]);
  });
});

describe("isNavActive", () => {
  it("ホーム（/dashboard）は完全一致のときのみアクティブ", () => {
    expect(isNavActive("/dashboard", "/dashboard")).toBe(true);
    expect(isNavActive("/transactions", "/dashboard")).toBe(false);
  });

  it("配下のパスでもアクティブになる", () => {
    expect(isNavActive("/transactions", "/transactions")).toBe(true);
    expect(isNavActive("/transactions/new", "/transactions")).toBe(true);
    expect(isNavActive("/categories/abc/edit", "/categories")).toBe(true);
  });

  it("前方一致しないパスは非アクティブ", () => {
    expect(isNavActive("/members", "/transactions")).toBe(false);
    expect(isNavActive("/transactions-archive", "/transactions")).toBe(false);
  });
});
```

`components/features/layout/mobile-tab-bar.test.tsx` の 6 行目と 16 行目を更新:

- 6 行目: `const usePathnameMock = vi.fn(() => "/dashboard");`
- 16 行目:

```typescript
    expect(screen.getByRole("link", { name: "ホーム" })).toHaveAttribute("href", "/dashboard");
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test:run -- components/features/layout/nav-items.test.ts components/features/layout/mobile-tab-bar.test.tsx`
Expected: FAIL（href が `/` のまま）

- [ ] **Step 3: 実装を更新（Green）**

`components/features/layout/nav-items.ts`:

- `NAV_ITEMS` 先頭を `{ href: "/dashboard", label: "ホーム", icon: House },` に変更
- `isNavActive` の特例を変更:

```typescript
/** ホームは完全一致、それ以外はセグメント単位の前方一致でアクティブ判定する。 */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
```

`components/features/layout/app-header.tsx` の 37 行目を変更:

```tsx
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2">
```

`app/households/actions.ts` の 2 箇所（グループ作成後・招待受諾後）の `redirect("/");` を `redirect("/dashboard");` に変更。

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test:run -- components/features/layout && npm run typecheck`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add components/features/layout app/households/actions.ts
git commit -m "refactor: アプリ内のホーム参照を /dashboard に張り替え"
```

---

## Task 5: Hero コンポーネント

**Files:**
- Create: `components/features/landing/hero.tsx`
- Test: `components/features/landing/hero.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

`components/features/landing/hero.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Hero } from "./hero";

describe("Hero", () => {
  it("ヘッドラインとサブコピーを表示する", () => {
    render(<Hero />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "家計を、みんなで一緒に。",
    );
    expect(screen.getByText(/グループで収支を共有し/)).toBeInTheDocument();
  });

  it("登録・ログインへの CTA リンクを持つ", () => {
    render(<Hero />);

    expect(
      screen.getByRole("link", { name: /無料で始める/ }),
    ).toHaveAttribute("href", "/register");
    expect(screen.getByRole("link", { name: "ログイン" })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test:run -- components/features/landing/hero.test.tsx`
Expected: FAIL（`Hero` が未定義）

- [ ] **Step 3: 最小実装**

`components/features/landing/hero.tsx`:

```tsx
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** ランディングのヒーロー。PC は左テキスト＋右プレビューの非対称、スマホは中央寄せ縦積み。 */
export function Hero() {
  return (
    <section className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-16 md:grid-cols-2 md:items-center md:py-24">
      <div className="text-center md:text-left">
        <span className="inline-block rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground">
          家族で使う家計簿
        </span>
        <h1 className="mt-4 font-heading text-4xl leading-tight font-extrabold text-foreground md:text-5xl">
          家計を、
          <br />
          みんなで一緒に。
        </h1>
        <p className="mt-4 text-muted-foreground md:text-lg">
          グループで収支を共有し、月次で自動集計。誰が何に使ったか一目で分かる。
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center md:justify-start">
          <Link
            href="/register"
            className={cn(
              buttonVariants({ size: "lg" }),
              "w-full rounded-full shadow-soft sm:w-auto",
            )}
          >
            無料で始める
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "w-full rounded-full sm:w-auto",
            )}
          >
            ログイン
          </Link>
        </div>
      </div>

      {/* アプリプレビュー（CSS のみのモック） */}
      <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-lifted">
        <p className="text-xs text-muted-foreground">今月の収支</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-income-soft p-3">
            <p className="text-xs text-income">収入</p>
            <p className="font-heading text-lg font-bold text-income">¥320,000</p>
          </div>
          <div className="rounded-xl bg-expense-soft p-3">
            <p className="text-xs text-expense">支出</p>
            <p className="font-heading text-lg font-bold text-expense">¥198,400</p>
          </div>
        </div>
        <div className="mt-4 flex h-24 items-end gap-2" aria-hidden>
          {[50, 80, 60, 95, 65, 82].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-primary/80"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test:run -- components/features/landing/hero.test.tsx`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add components/features/landing/hero.tsx components/features/landing/hero.test.tsx
git commit -m "feat: ランディングの Hero セクションを追加"
```

---

## Task 6: FeatureBento コンポーネント

**Files:**
- Create: `components/features/landing/feature-bento.tsx`
- Test: `components/features/landing/feature-bento.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

`components/features/landing/feature-bento.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FeatureBento } from "./feature-bento";

describe("FeatureBento", () => {
  it("6つの機能ラベルをすべて表示する", () => {
    render(<FeatureBento />);

    for (const label of [
      "グループ共有",
      "収支記録",
      "月次分析",
      "メンバー別アクティビティ",
      "カテゴリ管理",
      "ダークモード",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test:run -- components/features/landing/feature-bento.test.tsx`
Expected: FAIL（`FeatureBento` が未定義）

- [ ] **Step 3: 最小実装**

`components/features/landing/feature-bento.tsx`:

```tsx
import {
  ChartPie,
  MoonStar,
  ReceiptJapaneseYen,
  Tags,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

type Feature = {
  title: string;
  description: string;
  icon: LucideIcon;
};

const FEATURES: Feature[] = [
  {
    title: "グループ共有",
    description: "家族やパートナーと家計簿を共有。招待リンクですぐ参加。",
    icon: Users,
  },
  {
    title: "収支記録",
    description: "日付・金額・カテゴリ・メモを数タップで。登録者も自動記録。",
    icon: ReceiptJapaneseYen,
  },
  {
    title: "月次分析",
    description: "月別推移グラフとカテゴリ別円グラフで使いみちを可視化。",
    icon: ChartPie,
  },
  {
    title: "メンバー別アクティビティ",
    description: "誰がいつ何に使ったかをメンバーごとに集計。",
    icon: UsersRound,
  },
  {
    title: "カテゴリ管理",
    description: "デフォルト＋グループ共有のカスタムカテゴリを自由に管理。",
    icon: Tags,
  },
  {
    title: "ダークモード",
    description: "ライト／ダーク／システムに対応。目にやさしい配色。",
    icon: MoonStar,
  },
];

/** 機能紹介のグリッド。PC はベント型、スマホは1カラム。 */
export function FeatureBento() {
  return (
    <section
      id="features"
      className="mx-auto w-full max-w-5xl px-4 py-16 md:py-20"
    >
      <h2 className="text-center font-heading text-3xl font-bold text-foreground">
        家計の「見える化」に必要なものを
      </h2>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ title, description, icon: Icon }) => (
          <div
            key={title}
            className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
              <Icon className="size-5" aria-hidden />
            </span>
            <h3 className="mt-4 font-heading text-lg font-bold text-foreground">
              {title}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test:run -- components/features/landing/feature-bento.test.tsx`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add components/features/landing/feature-bento.tsx components/features/landing/feature-bento.test.tsx
git commit -m "feat: ランディングの機能紹介グリッドを追加"
```

---

## Task 7: Steps コンポーネント

**Files:**
- Create: `components/features/landing/steps.tsx`
- Test: `components/features/landing/steps.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

`components/features/landing/steps.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Steps } from "./steps";

describe("Steps", () => {
  it("3つのステップを表示する", () => {
    render(<Steps />);

    expect(screen.getByText("アカウント登録")).toBeInTheDocument();
    expect(screen.getByText("グループを作成")).toBeInTheDocument();
    expect(screen.getByText("記録をはじめる")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test:run -- components/features/landing/steps.test.tsx`
Expected: FAIL（`Steps` が未定義）

- [ ] **Step 3: 最小実装**

`components/features/landing/steps.tsx`:

```tsx
type Step = {
  no: string;
  title: string;
  description: string;
};

const STEPS: Step[] = [
  {
    no: "1",
    title: "アカウント登録",
    description: "メールアドレスとパスワードで30秒で登録。",
  },
  {
    no: "2",
    title: "グループを作成",
    description: "家計簿グループを作って、家族やパートナーを招待。",
  },
  {
    no: "3",
    title: "記録をはじめる",
    description: "収支を記録すると、ダッシュボードに自動で集計。",
  },
];

/** 使い方の3ステップ。 */
export function Steps() {
  return (
    <section id="steps" className="mx-auto w-full max-w-5xl px-4 py-16 md:py-20">
      <h2 className="text-center font-heading text-3xl font-bold text-foreground">
        はじめ方はかんたん3ステップ
      </h2>
      <ol className="mt-10 grid gap-6 md:grid-cols-3">
        {STEPS.map(({ no, title, description }) => (
          <li
            key={no}
            className="rounded-2xl border border-border/70 bg-card p-6 shadow-soft"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-primary font-heading text-lg font-bold text-primary-foreground">
              {no}
            </span>
            <h3 className="mt-4 font-heading text-lg font-bold text-foreground">
              {title}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test:run -- components/features/landing/steps.test.tsx`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add components/features/landing/steps.tsx components/features/landing/steps.test.tsx
git commit -m "feat: ランディングの使い方3ステップを追加"
```

---

## Task 8: FinalCTA コンポーネント

**Files:**
- Create: `components/features/landing/final-cta.tsx`
- Test: `components/features/landing/final-cta.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

`components/features/landing/final-cta.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FinalCta } from "./final-cta";

describe("FinalCta", () => {
  it("登録への CTA リンクを持つ", () => {
    render(<FinalCta />);

    expect(
      screen.getByRole("link", { name: /無料で始める/ }),
    ).toHaveAttribute("href", "/register");
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test:run -- components/features/landing/final-cta.test.tsx`
Expected: FAIL（`FinalCta` が未定義）

- [ ] **Step 3: 最小実装**

`components/features/landing/final-cta.tsx`:

```tsx
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** ページ末尾のグリーン背景の締めCTA。 */
export function FinalCta() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-16">
      <div className="rounded-3xl bg-primary px-6 py-14 text-center shadow-lifted">
        <h2 className="font-heading text-3xl font-bold text-primary-foreground">
          今日から家計を見える化
        </h2>
        <p className="mt-3 text-primary-foreground/85">
          無料で使えます。まずはグループを作ってみましょう。
        </p>
        <Link
          href="/register"
          className={cn(
            buttonVariants({ variant: "secondary", size: "lg" }),
            "mt-8 rounded-full shadow-soft",
          )}
        >
          無料で始める
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test:run -- components/features/landing/final-cta.test.tsx`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add components/features/landing/final-cta.tsx components/features/landing/final-cta.test.tsx
git commit -m "feat: ランディングの締めCTAを追加"
```

---

## Task 9: LandingHeader コンポーネント

**Files:**
- Create: `components/features/landing/landing-header.tsx`
- Test: `components/features/landing/landing-header.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

`components/features/landing/landing-header.test.tsx`（`ThemeToggleButton` は `next-themes` 依存のためモックする）:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LandingHeader } from "./landing-header";

vi.mock("@/components/features/layout/theme-toggle", () => ({
  ThemeToggleButton: () => <button type="button">テーマを切り替え</button>,
}));

describe("LandingHeader", () => {
  it("ログイン・登録リンクを表示する", () => {
    render(<LandingHeader />);

    expect(screen.getByRole("link", { name: "ログイン" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(
      screen.getByRole("link", { name: /無料で始める/ }),
    ).toHaveAttribute("href", "/register");
  });

  it("テーマ切り替えを表示する", () => {
    render(<LandingHeader />);

    expect(
      screen.getByRole("button", { name: "テーマを切り替え" }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test:run -- components/features/landing/landing-header.test.tsx`
Expected: FAIL（`LandingHeader` が未定義）

- [ ] **Step 3: 最小実装**

`components/features/landing/landing-header.tsx`:

```tsx
import Link from "next/link";
import { PiggyBank } from "lucide-react";

import { ThemeToggleButton } from "@/components/features/layout/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** 公開ランディング用のヘッダー（ロゴ・アンカーナビ・テーマ・認証導線）。 */
export function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft">
            <PiggyBank className="size-5" aria-hidden />
          </span>
          <span className="font-heading text-base font-bold tracking-wide">
            家計簿アプリ
          </span>
        </Link>

        <nav
          aria-label="セクション"
          className="ml-4 hidden flex-1 items-center gap-1 md:flex"
        >
          <a
            href="#features"
            className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            機能
          </a>
          <a
            href="#steps"
            className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            使い方
          </a>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggleButton />
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "rounded-full",
            )}
          >
            ログイン
          </Link>
          <Link
            href="/register"
            className={cn(
              buttonVariants({ size: "sm" }),
              "rounded-full shadow-soft",
            )}
          >
            無料で始める
          </Link>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test:run -- components/features/landing/landing-header.test.tsx`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add components/features/landing/landing-header.tsx components/features/landing/landing-header.test.tsx
git commit -m "feat: ランディング用ヘッダーを追加"
```

---

## Task 10: LandingFooter コンポーネント

**Files:**
- Create: `components/features/landing/landing-footer.tsx`
- Test: `components/features/landing/landing-footer.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

`components/features/landing/landing-footer.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LandingFooter } from "./landing-footer";

describe("LandingFooter", () => {
  it("コピーライトとログインリンクを表示する", () => {
    render(<LandingFooter />);

    expect(screen.getByText(/家計簿アプリ/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ログイン" })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm run test:run -- components/features/landing/landing-footer.test.tsx`
Expected: FAIL（`LandingFooter` が未定義）

- [ ] **Step 3: 最小実装**

`components/features/landing/landing-footer.tsx`:

```tsx
import Link from "next/link";

/** 公開ランディング用のフッター。 */
export function LandingFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
        <p>© {new Date().getFullYear()} 家計簿アプリ</p>
        <nav className="flex items-center gap-4" aria-label="フッター">
          <Link href="/login" className="hover:text-foreground">
            ログイン
          </Link>
          <Link href="/register" className="hover:text-foreground">
            新規登録
          </Link>
        </nav>
      </div>
    </footer>
  );
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm run test:run -- components/features/landing/landing-footer.test.tsx`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add components/features/landing/landing-footer.tsx components/features/landing/landing-footer.test.tsx
git commit -m "feat: ランディング用フッターを追加"
```

---

## Task 11: ランディングページの組み立て（app/page.tsx）

**Files:**
- Create: `app/page.tsx`

- [ ] **Step 1: ページを実装**

`app/page.tsx`:

```tsx
import type { Metadata } from "next";

import { FeatureBento } from "@/components/features/landing/feature-bento";
import { FinalCta } from "@/components/features/landing/final-cta";
import { Hero } from "@/components/features/landing/hero";
import { LandingFooter } from "@/components/features/landing/landing-footer";
import { LandingHeader } from "@/components/features/landing/landing-header";
import { Steps } from "@/components/features/landing/steps";

export const metadata: Metadata = {
  title: "家計簿アプリ｜家計を、みんなで一緒に。",
  description:
    "家族やパートナーとグループで収支を共有し、月次で自動集計。誰が何に使ったか一目で分かる家計簿アプリ。",
};

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <LandingHeader />
      <main className="flex-1">
        <Hero />
        <FeatureBento />
        <Steps />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
```

- [ ] **Step 2: 型チェック・lint・全ユニットテスト**

Run: `npm run typecheck && npm run lint && npm run test:run`
Expected: すべて PASS

- [ ] **Step 3: 開発サーバーで目視確認（任意）**

Run: `npm run dev` を起動し、ブラウザで `http://localhost:3000/` を開く。未ログインで LP が表示され、`/login` にリダイレクトされないこと、CTA から `/register`・`/login` に遷移できることを確認。確認後サーバーを停止。

- [ ] **Step 4: コミット**

```bash
git add app/page.tsx
git commit -m "feat: 公開ランディングページを追加"
```

---

## Task 12: E2E テストを /dashboard 移動に追従

**Files:**
- Modify: `e2e/auth.spec.ts`, `e2e/transactions.spec.ts`, `e2e/members.spec.ts`, `e2e/household.spec.ts`, `e2e/categories.spec.ts`, `e2e/analytics.spec.ts`, `e2e/settings.spec.ts`, `e2e/dashboard.spec.ts`, `e2e/theme.spec.ts`

- [ ] **Step 1: ルート URL を参照する箇所を更新**

各ファイルで以下を置換する。

(a) グループ作成／招待受諾後の遷移先アサーション:
`await expect(page).toHaveURL(/\/$/);` → `await expect(page).toHaveURL(/\/dashboard$/);`
対象行: `transactions.spec.ts:16`, `members.spec.ts:18`, `household.spec.ts:37,64,74,98`, `categories.spec.ts:19`, `analytics.spec.ts:18`, `settings.spec.ts:18`, `dashboard.spec.ts:18`, `theme.spec.ts:36`

(b) ログイン済みでダッシュボードへ移動する `page.goto("/")` → `page.goto("/dashboard")`
対象行: `members.spec.ts:29`, `analytics.spec.ts:29`, `dashboard.spec.ts:29`

(c) `e2e/auth.spec.ts` の保護ルートリダイレクトテスト（4〜10行目）を `/dashboard` 基準に変更する:

```typescript
  test("未認証でダッシュボードにアクセスするとログインへリダイレクトされる", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel("メールアドレス")).toBeVisible();
  });
```

- [ ] **Step 2: ルートURL参照が残っていないことを確認**

Run: `grep -rn 'toHaveURL(/\\/\$/)\|goto("/")' e2e/`
Expected: 出力なし（すべて `/dashboard` に置換済み）

- [ ] **Step 3: 新規 E2E（LP）を追加**

`e2e/auth.spec.ts` の `test.describe("認証ルーティング", ...)` 内に、未認証LP表示とログイン済みリダイレクトのテストを追加する:

```typescript
  test("未認証で / にアクセスするとランディングが表示される", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", { name: /家計を、みんなで一緒に。/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /無料で始める/ }).first(),
    ).toHaveAttribute("href", "/register");
  });
```

ログイン済みで `/` → `/households` のテストは storageState を使う既存スペック（例 `dashboard.spec.ts`）の `test.describe` 内に追加する:

```typescript
  test("ログイン済みで / に来るとグループ選択へリダイレクトされる", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/households$/);
  });
```

- [ ] **Step 4: E2E を実行**

Run: `npm run test:e2e`
Expected: すべて PASS

- [ ] **Step 5: コミット**

```bash
git add e2e
git commit -m "test: ダッシュボード移動とランディング追加に合わせて E2E を更新"
```

---

## Task 13: 最終検証とセッションログ

**Files:**
- Create: `docs/sessions/2026-06-15_landing-page.md`（`/project:new-session` の形式に従う）

- [ ] **Step 1: 全自動チェックを実行**

Run: `npm run typecheck && npm run lint && npm run test:run && npm run test:e2e`
Expected: すべて PASS

- [ ] **Step 2: セッションログを作成・記入**

`docs/sessions/2026-06-15_landing-page.md` に、実施内容（LP追加・`/` 公開化・ダッシュボードの `/dashboard` 移動・E2E更新）と結果を記録する。

- [ ] **Step 3: コミット**

```bash
git add docs/sessions/2026-06-15_landing-page.md
git commit -m "docs: ランディングページ作成のセッションログを追加"
```

---

## Self-Review

- **Spec coverage:** LP配置（Task 11）／6セクション（Task 5〜11）／レスポンシブ（各コンポーネントの `md:` クラス）／middleware の `/` 公開・ログイン済みリダイレクト（Task 1,2）／`/`→`/dashboard` 参照張り替え（Task 3,4）／テスト方針（各 Task のユニット + Task 12 E2E）。仕様の各項目に対応タスクあり。
- **Placeholder scan:** 各コード手順に実コードを記載。プレースホルダなし。
- **Type consistency:** コンポーネント名は `Hero` / `FeatureBento` / `Steps` / `FinalCta` / `LandingHeader` / `LandingFooter` で `app/page.tsx` の import と一致。`isPublicPath` のシグネチャは Task 1（定義）と Task 2（利用）で一致。`isNavActive` の特例値は `/dashboard` に統一。
