# ビジュアル統一 波2（周辺ページへの適用）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** フォーム系・一覧系・グループ管理の周辺ページ（transactions/new・[id]/edit、categories 一式、members、settings、help、households）を波0の共通プリミティブで再構成し、波1で統一したコア3画面と同じ最上部・節見出し・カード面の表現に揃える。

**Architecture:** 波0で作った `components/shared/`（PageHeader / SectionHeading / Surface）を各ページへ適用する。ページのデータ取得・Server Actions・ルーティング・フォームコンポーネント（TransactionForm / CategoryForm / ProfileForm 等）の内部は一切変更せず、各ページの `return (...)` の JSX とインポートのみ差し替える。`Card`/`CardHeader`/`CardTitle` の直書きは `PageHeader` + `Surface` + `SectionHeading` に置換する（`Surface` は shadcn `Card` をラップしているため `CardContent`/`CardTitle` 等の子はそのまま使える）。

**Tech Stack:** Next.js App Router / TypeScript / Tailwind CSS v4 / shadcn/ui / Vitest + RTL / Playwright（E2E）/ lucide-react

## Global Constraints

- `components/ui/`（shadcn）は直接編集しない。世界観は `components/shared/` とページ側で作る。
- 機能・URL・データ挙動は不変（見た目とマークアップのみ）。Server Actions / 取得ロジック / フォームコンポーネント内部は変更しない。
- 既存テスト（unit 324件 + E2E）を壊さない。特に以下を**必ず維持**する:
  - `data-testid="category-row"`（categories 一覧の行）
  - `data-testid="household-card"` / `data-testid="active-badge"`（households）
  - households のグループ名は `[data-testid="household-card"] [data-slot="card-title"] span.break-all` で参照される（E2E `household.spec.ts:25`）。**`CardTitle` と `span.break-all` を残す**こと。
  - フォームのラベル・ボタン文言（例: 「カテゴリ名」「表示名」「追加する」「更新する」「登録する」「保存する」「グループを作成」「グループ名」）は各フォームコンポーネントが所有しており不変。
  - 戻りリンク文言「一覧へ戻る」「カテゴリ一覧へ戻る」「ダッシュボードへ」。
- ライト/ダーク両対応。リビールは全ページ共通の下記 `reveal` を使い、`prefers-reduced-motion` は tailwind の `animate-in`（tw-animate-css）の既定挙動に従う（波1と同一）。
- リビール定数（各ページのファイル内で定義、波1と同一文字列）:
  ```ts
  const reveal =
    "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 ease-out";
  ```
- フォーム面の標準形（本計画の共通パターン）:
  ```tsx
  <Surface variant="raised">
    <CardContent className="pt-6">{/* フォーム本体 */}</CardContent>
  </Surface>
  ```
  （`CardHeader` を外すと Card のヘッダ用 gap が無くなるため `CardContent` に `pt-6` を補う。`Card` の `py-6` と `CardContent` の `px-6` で左右・下の余白は確保される。）
- 各ファイルのテストは co-located。import エイリアス `@/`。
- これらのページは Server Component のレイアウト変更のみで、新規の unit テスト対象ロジックは無い。各タスクの検証は `npm run typecheck` / `npm run lint` / `npm run test:run`（既存スイートが緑のまま）で行う。E2E 回帰と目視スクショ（ライト/ダーク）はコントローラが全タスク後にまとめて実行する（波1と同方針）。
- コミットメッセージは `<type>: <日本語説明>`、末尾に `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。

## 波1からの繰り越し（本計画での扱い）

- `members/loading.tsx` の旧 `Card className="shadow-soft ring-0"` → **Task 5 で Surface 化**。
- `StatTile` の関数 prop 由来 RSC フットガン（未配線）→ 本波でも StatTile は配線しないため**対象外**（使用時にハーデニング）。
- `SectionHeading` の action スロット（dashboard「最近の取引」）→ 本波の対象ページでは不要のため**対象外**。

---

### Task 1: 収支フォームページ（new / edit）

`transactions/new` と `transactions/[id]/edit` の最上部 `Card + CardHeader + CardTitle` を `PageHeader` + `Surface` に置換する。フォーム本体（`TransactionForm`）・削除フォーム・戻りリンクは挙動不変。

**Files:**
- Modify: `app/(dashboard)/transactions/new/page.tsx`
- Modify: `app/(dashboard)/transactions/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `PageHeader({ eyebrow?, title, meta?, actions?, className? })`、`Surface({ variant?: "raised"|"sunken"|"flat", ...CardProps })`、`CardContent`。

- [ ] **Step 1: new/page.tsx を置換**

`app/(dashboard)/transactions/new/page.tsx` のインポート部の `Card` 系を差し替え、`return` を置換する。

インポート差し替え（該当行のみ）:

```tsx
import { buttonVariants } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Surface } from "@/components/shared/surface";
```

`return (...)` を次に置換:

```tsx
  const reveal =
    "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 ease-out";

  return (
    <main className="mx-auto w-full max-w-md space-y-5 p-4 sm:py-8">
      <PageHeader eyebrow="記録" title="収支を追加" className={reveal} />
      <Surface
        variant="raised"
        className={reveal}
        style={{ animationDelay: "60ms" }}
      >
        <CardContent className="pt-6">
          <TransactionForm
            action={createTransaction}
            categories={categories}
            submitLabel="登録する"
          />
        </CardContent>
      </Surface>
      <div className="text-center">
        <Link
          href="/transactions"
          className={buttonVariants({ variant: "link" })}
        >
          一覧へ戻る
        </Link>
      </div>
    </main>
  );
```

- [ ] **Step 2: [id]/edit/page.tsx を置換**

`app/(dashboard)/transactions/[id]/edit/page.tsx` のインポート部 `Card` 系を差し替える（`Button` は削除フォームで使うため残す）:

```tsx
import { Button, buttonVariants } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Surface } from "@/components/shared/surface";
```

`return (...)` を次に置換:

```tsx
  const reveal =
    "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 ease-out";

  return (
    <main className="mx-auto w-full max-w-md space-y-5 p-4 sm:py-8">
      <PageHeader eyebrow="記録" title="収支を編集" className={reveal} />
      <Surface
        variant="raised"
        className={reveal}
        style={{ animationDelay: "60ms" }}
      >
        <CardContent className="space-y-4 pt-6">
          <TransactionForm
            action={updateTransaction}
            categories={categories}
            submitLabel="更新する"
            defaultValues={{
              id: transaction.id,
              type: transaction.type,
              amount: transaction.amount,
              date: transaction.date,
              category_id: transaction.category_id,
              memo: transaction.memo,
            }}
          />
          <form action={deleteTransaction} className="border-t pt-4">
            <input type="hidden" name="id" value={transaction.id} />
            <Button type="submit" variant="destructive" className="w-full">
              この収支を削除
            </Button>
          </form>
        </CardContent>
      </Surface>
      <div className="text-center">
        <Link
          href="/transactions"
          className={buttonVariants({ variant: "link" })}
        >
          一覧へ戻る
        </Link>
      </div>
    </main>
  );
```

- [ ] **Step 3: 検証**

Run: `npm run typecheck && npm run lint && npm run test:run`
Expected: typecheck/lint パス。unit 324件 緑のまま（このページの unit テストは無い）。

- [ ] **Step 4: コミット**

```bash
git add "app/(dashboard)/transactions/new/page.tsx" "app/(dashboard)/transactions/[id]/edit/page.tsx"
git commit -m "$(cat <<'EOF'
feat: 収支フォームページを共通プリミティブに統一

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: カテゴリフォームページ（new / edit）

`categories/new` と `categories/[id]/edit` を Task 1 と同じフォーム標準形に揃える。`CategoryForm`・戻りリンクは挙動不変。

**Files:**
- Modify: `app/(dashboard)/categories/new/page.tsx`
- Modify: `app/(dashboard)/categories/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `PageHeader`、`Surface`、`CardContent`。

- [ ] **Step 1: new/page.tsx を置換**

`app/(dashboard)/categories/new/page.tsx` 全体を次に置換:

```tsx
import Link from "next/link";

import { createCategory } from "@/app/(dashboard)/categories/actions";
import { CategoryForm } from "@/components/features/categories/category-form";
import { buttonVariants } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Surface } from "@/components/shared/surface";

export default function NewCategoryPage() {
  const reveal =
    "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 ease-out";

  return (
    <main className="mx-auto w-full max-w-md space-y-5 p-4 sm:py-8">
      <PageHeader eyebrow="設定" title="カテゴリを追加" className={reveal} />
      <Surface
        variant="raised"
        className={reveal}
        style={{ animationDelay: "60ms" }}
      >
        <CardContent className="pt-6">
          <CategoryForm action={createCategory} submitLabel="追加する" />
        </CardContent>
      </Surface>
      <div className="text-center">
        <Link href="/categories" className={buttonVariants({ variant: "link" })}>
          カテゴリ一覧へ戻る
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: [id]/edit/page.tsx を置換**

`app/(dashboard)/categories/[id]/edit/page.tsx` のインポート部 `Card` 系を差し替える:

```tsx
import { buttonVariants } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Surface } from "@/components/shared/surface";
```

`return (...)` を次に置換:

```tsx
  const reveal =
    "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 ease-out";

  return (
    <main className="mx-auto w-full max-w-md space-y-5 p-4 sm:py-8">
      <PageHeader eyebrow="設定" title="カテゴリを編集" className={reveal} />
      <Surface
        variant="raised"
        className={reveal}
        style={{ animationDelay: "60ms" }}
      >
        <CardContent className="pt-6">
          <CategoryForm
            action={updateCategory}
            submitLabel="更新する"
            defaultValues={{
              id: category.id,
              name: category.name,
              color: category.color,
              type: category.type,
            }}
          />
        </CardContent>
      </Surface>
      <div className="text-center">
        <Link href="/categories" className={buttonVariants({ variant: "link" })}>
          カテゴリ一覧へ戻る
        </Link>
      </div>
    </main>
  );
```

- [ ] **Step 3: 検証**

Run: `npm run typecheck && npm run lint && npm run test:run`
Expected: 全パス。

- [ ] **Step 4: コミット**

```bash
git add "app/(dashboard)/categories/new/page.tsx" "app/(dashboard)/categories/[id]/edit/page.tsx"
git commit -m "$(cat <<'EOF'
feat: カテゴリフォームページを共通プリミティブに統一

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 設定ページ（プロフィール / パスワード / アカウント削除）

`settings/page.tsx` の3枚の `Card + CardHeader + CardTitle` を `PageHeader` + `SectionHeading` + `Surface` に置換する。フォーム3種（ProfileForm / PasswordForm / AccountDeletionForm）は挙動不変。アカウント削除セクションは destructive を表すため `Surface variant="flat"` に `ring-destructive/30` を付ける。

**Files:**
- Modify: `app/(dashboard)/settings/page.tsx`

**Interfaces:**
- Consumes: `PageHeader`、`SectionHeading({ children, index?, className? })`、`Surface`、`CardContent`。

- [ ] **Step 1: page.tsx を置換**

`app/(dashboard)/settings/page.tsx` のインポート部 `Card` 系を差し替える:

```tsx
import { CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { SectionHeading } from "@/components/shared/section-heading";
import { Surface } from "@/components/shared/surface";
```

`return (...)` を次に置換:

```tsx
  const reveal =
    "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 ease-out";

  return (
    <main className="mx-auto w-full max-w-md space-y-6 p-4 sm:py-8">
      <PageHeader eyebrow="アカウント" title="設定" className={reveal} />

      <section className={reveal} style={{ animationDelay: "60ms" }}>
        <SectionHeading>プロフィール設定</SectionHeading>
        <Surface variant="raised">
          <CardContent className="pt-6">
            <ProfileForm
              action={updateProfile}
              defaultDisplayName={profile?.display_name ?? user.email ?? ""}
            />
          </CardContent>
        </Surface>
      </section>

      <section className={reveal} style={{ animationDelay: "120ms" }}>
        <SectionHeading>パスワード変更</SectionHeading>
        <Surface variant="raised">
          <CardContent className="pt-6">
            <PasswordForm action={changePassword} />
          </CardContent>
        </Surface>
      </section>

      <section className={reveal} style={{ animationDelay: "180ms" }}>
        <SectionHeading>アカウント削除</SectionHeading>
        <Surface variant="flat" className="ring-destructive/30">
          <CardContent className="pt-6">
            <AccountDeletionForm
              action={deleteAccount}
              email={user.email ?? ""}
            />
          </CardContent>
        </Surface>
      </section>
    </main>
  );
```

- [ ] **Step 2: 検証**

Run: `npm run typecheck && npm run lint && npm run test:run`
Expected: 全パス。`settings/actions.test.ts` は actions のテストでページ非依存のため緑のまま。

- [ ] **Step 3: コミット**

```bash
git add "app/(dashboard)/settings/page.tsx"
git commit -m "$(cat <<'EOF'
feat: 設定ページを共通プリミティブに統一

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: カテゴリ一覧ページ

`categories/page.tsx` の素の `<h1>` を `PageHeader`（追加ボタンを actions スロットへ）に、グループ見出し `<h2>` を `SectionHeading` に、行 `Card` を `Surface variant="raised"` に置換する。`data-testid="category-row"` と色スウォッチ・編集/削除操作は不変。

**Files:**
- Modify: `app/(dashboard)/categories/page.tsx`

**Interfaces:**
- Consumes: `PageHeader`、`SectionHeading`、`Surface`、`CardContent`。

- [ ] **Step 1: page.tsx を置換**

インポート部の `Card` 系を差し替える:

```tsx
import { buttonVariants } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { SectionHeading } from "@/components/shared/section-heading";
import { Surface } from "@/components/shared/surface";
```

`return (...)` を次に置換:

```tsx
  const reveal =
    "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 ease-out";

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:py-8">
      <PageHeader
        eyebrow="設定"
        title="カテゴリ"
        className={reveal}
        actions={
          <Link
            href="/categories/new"
            className={buttonVariants({ variant: "default", size: "sm" })}
          >
            <Plus className="size-4" aria-hidden />
            カテゴリを追加
          </Link>
        }
      />

      {GROUPS.map((group, gi) => {
        const items = categories.filter((c) => c.type === group.type);
        if (items.length === 0) {
          return null;
        }
        return (
          <section
            key={group.type}
            className={reveal}
            style={{ animationDelay: `${60 + gi * 60}ms` }}
          >
            <SectionHeading>{group.label}</SectionHeading>
            <ul className="grid gap-2 sm:grid-cols-2">
              {items.map((c) => (
                <li key={c.id}>
                  <Surface
                    variant="raised"
                    data-testid="category-row"
                    className="transition-shadow hover:shadow-lifted"
                  >
                    <CardContent className="flex items-center justify-between gap-3 py-3">
                      <span className="inline-flex min-w-0 items-center gap-3 text-sm">
                        <span
                          aria-hidden
                          className="inline-block size-8 shrink-0 rounded-xl shadow-soft"
                          style={{ backgroundColor: c.color ?? "#999" }}
                        />
                        <span className="truncate font-medium">{c.name}</span>
                      </span>
                      {c.is_default ? (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          デフォルト
                        </span>
                      ) : (
                        <span className="flex shrink-0 items-center gap-1">
                          <Link
                            href={`/categories/${c.id}/edit`}
                            className={buttonVariants({
                              variant: "ghost",
                              size: "sm",
                            })}
                          >
                            編集
                          </Link>
                          <DeleteCategoryButton
                            action={deleteCategory}
                            categoryId={c.id}
                          />
                        </span>
                      )}
                    </CardContent>
                  </Surface>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
```

- [ ] **Step 2: 検証**

Run: `npm run typecheck && npm run lint && npm run test:run`
Expected: 全パス。

- [ ] **Step 3: コミット**

```bash
git add "app/(dashboard)/categories/page.tsx"
git commit -m "$(cat <<'EOF'
feat: カテゴリ一覧ページを共通プリミティブに統一

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: メンバー別アクティビティページ + ローディング

`members/page.tsx` の素の `<h1>` を `PageHeader`（MonthNav を actions スロットへ）に置換する。`MemberActivity` は不変。あわせて波1繰り越しの `members/loading.tsx` の `Card` を `Surface` 化し、ヘッダースケルトンを他ページと揃える。

**Files:**
- Modify: `app/(dashboard)/members/page.tsx`
- Modify: `app/(dashboard)/members/loading.tsx`

**Interfaces:**
- Consumes: `PageHeader`、`Surface`、`CardContent`。

- [ ] **Step 1: page.tsx を置換**

インポートに追加:

```tsx
import { PageHeader } from "@/components/shared/page-header";
```

`return (...)` を次に置換:

```tsx
  const reveal =
    "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 ease-out";

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:py-8">
      <PageHeader
        eyebrow="メンバー"
        title="メンバー別アクティビティ"
        className={reveal}
        actions={
          <MonthNav
            label={formatPeriodLabel(range)}
            prevHref={prevHref}
            nextHref={nextHref}
          />
        }
      />

      <div className={reveal} style={{ animationDelay: "60ms" }}>
        <MemberActivity summaries={summaries} txs={txs} />
      </div>
    </main>
  );
```

- [ ] **Step 2: loading.tsx を置換**

`app/(dashboard)/members/loading.tsx` 全体を次に置換:

```tsx
import { CardContent } from "@/components/ui/card";
import { Surface } from "@/components/shared/surface";

/** メンバー別アクティビティのデータ取得中に表示するスケルトン。 */
export default function MembersLoading() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:py-8">
      <div className="flex items-center justify-between">
        <div className="h-9 w-56 animate-pulse rounded-md bg-muted/60" />
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted/60" />
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Surface key={i} variant="raised">
            <CardContent className="space-y-2 py-4">
              <div className="h-5 w-40 animate-pulse rounded-md bg-muted/60" />
              <div className="h-4 w-full animate-pulse rounded-md bg-muted/60" />
            </CardContent>
          </Surface>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: 検証**

Run: `npm run typecheck && npm run lint && npm run test:run`
Expected: 全パス。

- [ ] **Step 4: コミット**

```bash
git add "app/(dashboard)/members/page.tsx" "app/(dashboard)/members/loading.tsx"
git commit -m "$(cat <<'EOF'
feat: メンバー別ページとローディングを共通プリミティブに統一

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: ヘルプページ

`help/page.tsx` の素の `<h1>` + 説明文ブロックを `PageHeader` + muted 説明文に置換する。`HelpAccordion` は不変。

**Files:**
- Modify: `app/(dashboard)/help/page.tsx`

**Interfaces:**
- Consumes: `PageHeader`。

- [ ] **Step 1: page.tsx を置換**

`app/(dashboard)/help/page.tsx` 全体を次に置換:

```tsx
import type { Metadata } from "next";

import { HelpAccordion } from "@/components/features/help/help-accordion";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = {
  title: "ヘルプ｜Shallet",
};

export default function HelpPage() {
  const reveal =
    "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-500 ease-out";

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 p-4 sm:py-8">
      <div className={reveal}>
        <PageHeader eyebrow="サポート" title="ヘルプ" />
        <p className="mt-2 text-sm text-muted-foreground">
          各画面の操作方法をまとめています。見たい項目をタップすると手順が開きます。
        </p>
      </div>

      <div className={reveal} style={{ animationDelay: "60ms" }}>
        <HelpAccordion />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: 検証**

Run: `npm run typecheck && npm run lint && npm run test:run`
Expected: 全パス。

- [ ] **Step 3: コミット**

```bash
git add "app/(dashboard)/help/page.tsx"
git commit -m "$(cat <<'EOF'
feat: ヘルプページを共通プリミティブに統一

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: 家計簿グループ管理ページ（households）

`app/households/page.tsx`（認証済みだが `(dashboard)` シェル外で独自トップバーを持つ）の見出しを `PageHeader` に、全 `Card` を `Surface` に置換する。独自トップバー（ロゴ・ログアウト・テーマ切替）はそのまま維持。`data-testid="household-card"` / `data-testid="active-badge"` / `CardTitle`（`data-slot="card-title"`）+ `span.break-all`、月区切りフォーム・招待・削除ダイアログは挙動不変。

**Files:**
- Modify: `app/households/page.tsx`

**Interfaces:**
- Consumes: `PageHeader`、`Surface`、`CardContent`、`CardHeader`、`CardTitle`、`CardDescription`。

- [ ] **Step 1: インポート差し替え**

`app/households/page.tsx` のインポート部の `Card` 系を次に差し替える（`CardHeader`/`CardTitle`/`CardDescription`/`CardContent` は子要素として残し、`Card` 自体は `Surface` に置換するため import から外す）:

```tsx
import { Button, buttonVariants } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { Surface } from "@/components/shared/surface";
```

- [ ] **Step 2: 見出しブロックを PageHeader に置換**

次のブロック:

```tsx
      <div>
        <h1 className="text-2xl font-bold">家計簿グループ</h1>
        <p className="text-sm text-muted-foreground">
          ログイン中: {user?.email}
        </p>
      </div>
```

を次に置換:

```tsx
      <PageHeader
        eyebrow="グループ"
        title="家計簿グループ"
        meta={`ログイン中: ${user?.email ?? ""}`}
      />
```

- [ ] **Step 3: 空状態カードを Surface に置換**

```tsx
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            まだ参加しているグループがありません。下のフォームから新しいグループを作成しましょう。
          </CardContent>
        </Card>
```

を次に置換:

```tsx
        <Surface variant="raised">
          <CardContent className="py-6 text-sm text-muted-foreground">
            まだ参加しているグループがありません。下のフォームから新しいグループを作成しましょう。
          </CardContent>
        </Surface>
```

- [ ] **Step 4: グループカードを Surface に置換**

```tsx
                <Card
                  data-testid="household-card"
                  className={
                    isActive
                      ? "shadow-soft ring-0 outline-2 outline-primary"
                      : "shadow-soft ring-0"
                  }
                >
```

を次に置換（`Card` → `Surface variant="raised"`、active は outline を上乗せ）:

```tsx
                <Surface
                  variant="raised"
                  data-testid="household-card"
                  className={
                    isActive ? "outline-2 outline-offset-2 outline-primary" : ""
                  }
                >
```

この `<Card ...>` に対応する閉じタグ `</Card>`（同ブロック末尾）を `</Surface>` に変更する。中の `CardHeader`/`CardTitle`（`span.break-all` 含む）/`CardContent` はそのまま残す。

- [ ] **Step 5: 「新しいグループを作成」カードを Surface に置換**

```tsx
      <Card>
        <CardHeader>
          <CardTitle>新しいグループを作成</CardTitle>
          <CardDescription>
            作成者は自動的にオーナーになります。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateHouseholdForm action={createHousehold} />
        </CardContent>
      </Card>
```

を次に置換（`Card` → `Surface variant="raised"`、`</Card>` → `</Surface>`）:

```tsx
      <Surface variant="raised">
        <CardHeader>
          <CardTitle>新しいグループを作成</CardTitle>
          <CardDescription>
            作成者は自動的にオーナーになります。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateHouseholdForm action={createHousehold} />
        </CardContent>
      </Surface>
```

- [ ] **Step 6: ロゴのコンテナにある残りの `Card` 参照が無いことを確認**

Run: `grep -n "<Card\b\|</Card>\|[^a-zA-Z]Card[^a-zA-Z(]" "app/households/page.tsx"`
Expected: `CardContent`/`CardHeader`/`CardTitle`/`CardDescription` のみがヒットし、素の `<Card`/`</Card>` は0件。

- [ ] **Step 7: 検証**

Run: `npm run typecheck && npm run lint && npm run test:run`
Expected: 全パス。

- [ ] **Step 8: コミット**

```bash
git add "app/households/page.tsx"
git commit -m "$(cat <<'EOF'
feat: 家計簿グループ管理ページを共通プリミティブに統一

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## コントローラによる最終検証（全タスク後）

波1と同方針で、E2E と目視はコントローラがまとめて実行する:

- `npm run build`（本番ビルドで RSC 境界エラーが無いことを確認。波1で `/analytics` の関数 prop が build をすり抜けた教訓に従い必須）。
- `npm run test:e2e`。特に本波で触れたページのスペックを重点確認:
  - `e2e/categories.spec.ts`（一覧・追加・編集・削除、`category-row`）
  - `e2e/members.spec.ts`
  - `e2e/settings.spec.ts`
  - `e2e/household.spec.ts`（`household-card` / `active-badge` / `[data-slot="card-title"] span.break-all`）
- Playwright で主要ページのスクショをライト/ダーク両方で目視（categories 一覧・settings・households・各フォーム）。
- DoD: 全対象ページが PageHeader / SectionHeading / Surface で構成され、コア3画面と最上部・節見出し・カード面の表現が一致。ライト/ダーク破綻なし。

## Self-Review メモ

- spec §5 波2 の対象列挙（transactions/new・[id]/edit、categories 一式、members、settings、help、households）は Task 1〜7 で全て被覆。`household` 専用ルートは存在せず、グループ設定は `app/households/page.tsx` に集約されている（Task 7 で対応）。
- 新規プリミティブは追加しない（YAGNI）。フォーム標準形は既存 `Surface`+`CardContent` の組合せで表現し、共有 Shell 化はしない（ページごとに削除ボタン・複数パネル等の差異があり、抽象化の利得が小さいため）。
- 型・プロパティ名は波0/波1 で確定済みの `PageHeader` / `Surface` / `SectionHeading` のシグネチャに一致。
