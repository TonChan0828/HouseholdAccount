# ビジュアル統一 波3（公開側への適用）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 公開側（認証フォーム3種・ランディングのヒーロー／カード面）を「やわらかな家計のリビング」のマテリアル表現に統一し、認証済みページ（波0〜2）と質感を揃える。

**Architecture:** 認証フォームは Card/CardContent 構造を持つため共通プリミティブ `Surface`（pillow 影）へ差し替える。ランディングのヒーロー／機能カード／ステップ／CTA は CardContent 構造を持たない独自マーケティングレイアウトのため、`Surface` を強制せずマテリアルの影トークン（`--shadow-pillow`）と有機角丸へ寄せ、ヒーローには局所的なやわらかい光（装飾グロー）を加える。全画面共通の `AmbientBackground`（呼吸グロー＋グレイン）はルートレイアウトに既設のため公開側でも有効で、本波では追加しない。挙動・URL・データ・Server Actions・フォームの入力項目は不変（見た目とマークアップのみ）。

**Tech Stack:** Next.js App Router / TypeScript / Tailwind CSS v4 / shadcn/ui / Vitest + RTL / Playwright（E2E）/ lucide-react

## Global Constraints

- `components/ui/`（shadcn）は直接編集しない。世界観は `components/shared/` とコンポーネント側で作る。
- 機能・URL・データ挙動は不変（見た目とマークアップのみ）。Server Actions / `useActionState` の配線 / 入力フィールド（name・type・autoComplete・minLength・required・aria-*）は変更しない。
- 既存テスト（unit 324件 + E2E）を壊さない。特に以下を維持する:
  - 認証フォームの `role="status"` / `role="alert"` / `htmlFor`・`id`（`email`/`password`/`confirmPassword`/`password-hint`）と全ラベル・ボタン文言（「ログイン」「登録する」「再設定メールを送信」「パスワードを設定」等）。
  - ランディングの本文テキスト（`hero.test.tsx` は「グループで収支を共有し…」、`steps.test.tsx` は「アカウント登録」等、`feature-bento.test.tsx` は各機能名、`landing-footer.test.tsx` は「Shallet」を検証）。**文言は一切変更しない。**
  - E2E `auth.spec.ts`（ログイン/登録/パスワード再設定への遷移）、`theme.spec.ts`、`demo.spec.ts`（ランディングからデモ導線）。リンク文言・href を維持する。
- マテリアルの影は既存トークンを使う: 盛り上がり面 = `shadow-[var(--shadow-pillow)]`、強調 = `shadow-lifted`（ホバー等）。`--shadow-pillow` は globals.css に定義済み。
- 装飾要素は `aria-hidden` かつ `pointer-events-none`。ライト/ダーク両対応。
- 各ファイルのテストは co-located。import エイリアス `@/`。これらは見た目変更のみで新規 unit テスト対象ロジックは無い。各タスクの検証は `npm run typecheck` / `npm run lint` / `npm run test:run`（既存スイートが緑のまま）。E2E と目視スクショ（ライト/ダーク）はコントローラが全タスク後に一括実行する。
- コミットメッセージは `<type>: <日本語説明>`、末尾に `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。

## スコープ補足（設計 §5 波3 の解釈）

- 設計は「landing ヒーロー刷新（マテリアル＋光）」「login / register / パスワード再設定（カード・フォーム統一）」と記載。
- 一貫性のため、ヒーローに加えて機能カード・ステップ・CTA の**影トークンも**マテリアルへ揃える（Task 3）。ヘッダー／フッターはカード面ではないナビ装飾のため対象外（YAGNI）。
- ランディングのマーケティングカードに `Surface` を使わない理由: shadcn `Card` は既定で `flex flex-col gap-6 py-6` を付与し、`p-5`/`p-6` のままアイコン→見出し→本文を積む現行レイアウトを崩すため。`Surface` は CardContent 構造を持つ認証フォームにのみ適用する。

---

### Task 1: 認証フォーム3種を Surface（pillow）へ統一

`auth-form.tsx` / `forgot-password-form.tsx` / `reset-password-form.tsx` の外側 `Card className="w-full shadow-lifted ring-0"` を `Surface variant="raised" className="w-full"` に置換する。内側の `CardHeader`/`CardTitle`/`CardDescription`/`CardContent`/`CardFooter`・フォーム配線・入力項目は不変。3ファイルとも同一の機械的変更。

**Files:**
- Modify: `components/features/auth/auth-form.tsx`
- Modify: `components/features/auth/forgot-password-form.tsx`
- Modify: `components/features/auth/reset-password-form.tsx`

**Interfaces:**
- Consumes: `Surface({ variant?: "raised"|"sunken"|"flat", ...CardProps })`（shadcn `Card` をラップ）。`"use client"` コンポーネントから素のコンポーネント `Surface` を import するのは Next.js App Router で許容される（Surface は server 専用 API を使わない）。

- [ ] **Step 1: auth-form.tsx を変更**

インポートの `Card` を除き `CardContent` 系を残し、`Surface` を追加する。`components/features/auth/auth-form.tsx` のインポート部:

```tsx
import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Surface } from "@/components/shared/surface";
```

JSX の外側要素を置換: 開始タグ

```tsx
    <Card className="w-full shadow-lifted ring-0">
```

を

```tsx
    <Surface variant="raised" className="w-full">
```

に、対応する閉じタグ `</Card>`（ファイル末尾付近）を `</Surface>` に変更する。

- [ ] **Step 2: forgot-password-form.tsx を変更**

同様にインポートの `Card` を外し `Surface` を追加:

```tsx
import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Surface } from "@/components/shared/surface";
```

開始タグ `<Card className="w-full shadow-lifted ring-0">` → `<Surface variant="raised" className="w-full">`、閉じタグ `</Card>` → `</Surface>`。

- [ ] **Step 3: reset-password-form.tsx を変更**

同様にインポートの `Card` を外し `Surface` を追加:

```tsx
import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_POLICY_HINT } from "@/lib/validations/auth";
```

> 注: reset-password-form.tsx は元々 `Link` を import していない。上記のとおり `Surface` を `@/lib/validations/auth` の直前に1行追加する形で挿入する:

```tsx
import { Surface } from "@/components/shared/surface";
import { PASSWORD_POLICY_HINT } from "@/lib/validations/auth";
```

開始タグ `<Card className="w-full shadow-lifted ring-0">` → `<Surface variant="raised" className="w-full">`、閉じタグ `</Card>` → `</Surface>`。

- [ ] **Step 4: 残存する素の Card 参照が無いことを確認**

Run: `grep -nE "<Card[ >]|</Card>" components/features/auth/auth-form.tsx components/features/auth/forgot-password-form.tsx components/features/auth/reset-password-form.tsx`
Expected: 0件（`CardContent`/`CardHeader` 等のみ残る）。

- [ ] **Step 5: 検証**

Run: `npm run typecheck && npm run lint && npm run test:run`
Expected: 全パス。`forgot-password-form.test.tsx` / `reset-password-form.test.tsx` はテキスト・role を検証するもので緑のまま。

- [ ] **Step 6: コミット**

```bash
git add components/features/auth/auth-form.tsx components/features/auth/forgot-password-form.tsx components/features/auth/reset-password-form.tsx
git commit -m "$(cat <<'EOF'
feat: 認証フォームを共通プリミティブ Surface に統一

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: ヒーローをマテリアル＋光にリフレッシュ

`hero.tsx` のアプリプレビューカードをマテリアル（pillow 影・有機角丸）に寄せ、プレビュー背後に局所的なやわらかい光（warm サブアクセントのグロー）を加える。本文・CTA リンク（href・文言）・金額テキストは不変。

**Files:**
- Modify: `components/features/landing/hero.tsx`

**Interfaces:**
- Consumes: なし（クラス変更と装飾要素の追加のみ）。

- [ ] **Step 1: hero.tsx を置換**

`components/features/landing/hero.tsx` 全体を次に置換:

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
            href="/demo"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "w-full rounded-full sm:w-auto",
            )}
          >
            ログインせずに試す
          </Link>
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "ghost", size: "lg" }),
              "w-full rounded-full sm:w-auto",
            )}
          >
            ログイン
          </Link>
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground md:text-left">
          登録不要・その場で操作できます（データは保存されません）。
        </p>
      </div>

      {/* アプリプレビュー（CSS のみのモック）。背後にやわらかい光を敷く。 */}
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-6 -z-10 rounded-[2.5rem] bg-accent-warm/20 blur-3xl"
        />
        <div className="rounded-[1.75rem] border border-border/60 bg-card p-5 shadow-[var(--shadow-pillow)] ring-1 ring-foreground/5">
          <p className="text-xs text-muted-foreground">今月の収支</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-income-soft p-3">
              <p className="text-xs text-income">収入</p>
              <p className="font-heading text-lg font-bold text-income">
                ¥320,000
              </p>
            </div>
            <div className="rounded-xl bg-expense-soft p-3">
              <p className="text-xs text-expense">支出</p>
              <p className="font-heading text-lg font-bold text-expense">
                ¥198,400
              </p>
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
      </div>
    </section>
  );
}
```

- [ ] **Step 2: 検証**

Run: `npm run typecheck && npm run lint && npm run test:run`
Expected: 全パス。`hero.test.tsx`（本文テキスト検証）緑のまま。

- [ ] **Step 3: コミット**

```bash
git add components/features/landing/hero.tsx
git commit -m "$(cat <<'EOF'
feat: ランディングのヒーローをマテリアルとやわらかな光にリフレッシュ

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: ランディングのカード面をマテリアルに統一

`feature-bento.tsx`・`steps.tsx`・`final-cta.tsx` のカード／ブロックの影を `--shadow-pillow` へ寄せ、機能カードにはホバーの持ち上げを加える。レイアウト構造・本文・リンクは不変。

**Files:**
- Modify: `components/features/landing/feature-bento.tsx`
- Modify: `components/features/landing/steps.tsx`
- Modify: `components/features/landing/final-cta.tsx`

**Interfaces:**
- Consumes: なし（クラス変更のみ）。

- [ ] **Step 1: feature-bento.tsx のカードを変更**

機能カードの `className`:

```tsx
            className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft"
```

を次に置換（pillow ＋ ホバー持ち上げ）:

```tsx
            className="rounded-2xl border border-border/70 bg-card p-5 shadow-[var(--shadow-pillow)] transition-shadow hover:shadow-lifted"
```

- [ ] **Step 2: steps.tsx のカードを変更**

ステップカードの `className`:

```tsx
            className="rounded-2xl border border-border/70 bg-card p-6 shadow-soft"
```

を次に置換:

```tsx
            className="rounded-2xl border border-border/70 bg-card p-6 shadow-[var(--shadow-pillow)]"
```

- [ ] **Step 3: final-cta.tsx のブロックを変更**

CTA ブロックの `className`:

```tsx
      <div className="rounded-3xl bg-primary px-6 py-14 text-center shadow-lifted">
```

を次に置換:

```tsx
      <div className="rounded-3xl bg-primary px-6 py-14 text-center shadow-[var(--shadow-pillow)]">
```

- [ ] **Step 4: 検証**

Run: `npm run typecheck && npm run lint && npm run test:run`
Expected: 全パス。`feature-bento.test.tsx` / `steps.test.tsx`（本文検証）緑のまま。

- [ ] **Step 5: コミット**

```bash
git add components/features/landing/feature-bento.tsx components/features/landing/steps.tsx components/features/landing/final-cta.tsx
git commit -m "$(cat <<'EOF'
feat: ランディングのカード面をマテリアルの影に統一

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## コントローラによる最終検証（全タスク後）

波1/波2と同方針:

- `npm run build`（公開側に RSC 境界エラーが無いことを確認。`Surface` を "use client" 認証フォームに取り込むため特に確認）。
- `npm run test:e2e`。重点: `auth.spec.ts`（ログイン/登録/パスワード再設定遷移）、`theme.spec.ts`、`demo.spec.ts`（ランディング→デモ導線）。
- Playwright でランディング（/）・ログイン・新規登録・パスワード再設定をライト/ダーク両方で目視スクショ。
- DoD: 認証フォームが `Surface`（pillow）で統一され、ランディングのヒーロー／カード面がマテリアルの影で揃う。ライト/ダーク破綻なし。これで全波（0〜3）完了。

## Self-Review メモ

- 設計 §5 波3 の対象（landing ヒーロー / login / register / パスワード再設定）は Task 1〜2 で被覆。一貫性のため機能カード・ステップ・CTA を Task 3 で追加整合（影トークンのみ）。
- 新規プリミティブは追加しない（YAGNI）。認証フォームのみ `Surface` を適用（Card 構造を持つため）。ランディングのマーケティングカードは `Surface` を強制せず影トークンで整合（理由は本書「スコープ補足」参照）。
- 入力フィールド・aria・role・文言・href は全て不変。テストはテキスト/role ベースのため緑を維持できる。
- 型・プロパティ名は確定済みの `Surface` シグネチャに一致。
