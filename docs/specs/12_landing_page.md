# ランディングページ 仕様書

## 概要

未ログインユーザー向けの公開ランディングページ（LP）を追加する。アプリの価値（家族・グループでの家計簿共有、収支記録、月次分析）を訴求し、登録・ログインへ誘導する。ポートフォリオとしての「入口」となる画面。

これまでトップ `/` は認証必須のダッシュボードだったが、本対応で `/` を公開LPに変更し、ダッシュボード本体は `/dashboard` へ移動する。

## 対象ユーザー・前提条件

- 未ログインの訪問者（新規ユーザー／ポートフォリオ閲覧者）
- ログイン済みユーザーが `/` に来た場合は `/households`（グループ選択）へ自動リダイレクトする
- 認証は不要。LP は `(auth)` / `(dashboard)` いずれのルートグループにも属さず、ルートレイアウトのみで描画する

## 画面・UI

### 表示内容

上から以下のセクションで構成する。`components/features/landing/` に各セクションを独立コンポーネントとして配置し、`app/page.tsx` で組み立てる。

1. **LandingHeader** — ロゴ、アンカーナビ（機能 / 使い方）、テーマトグル（既存 `ThemeToggle` を再利用）、「ログイン」「無料で始める」ボタン
2. **Hero**
   - ヘッドライン: 「家計を、みんなで一緒に。」
   - サブコピー: 「グループで収支を共有し、月次で自動集計。誰が何に使ったか一目で分かる。」
   - CTA: 「無料で始める」（`/register`）、「ログイン」（`/login`）
   - アプリプレビュー: 収入/支出サマリー＋棒グラフ風の CSS のみのモック
3. **FeatureBento** — 6機能を紹介
   - グループ共有 / 収支記録 / 月次分析 / メンバー別アクティビティ / カテゴリ管理 / ダークモード
   - lucide アイコンを使用
4. **Steps** — 3ステップ（① 登録 → ② グループ作成 → ③ 記録開始）
5. **FinalCTA** — グリーン背景の締めCTA（`/register`）
6. **LandingFooter** — コピーライト、簡単なリンク

### インタラクション・バリデーション

- レスポンシブ: PC（`md` 以上）は Hero を「左テキスト＋右プレビュー」の非対称、FeatureBento はベント型グリッド。スマホは Hero 中央寄せ・縦積み、FeatureBento は 1 カラム。同一 HTML を Tailwind ブレークポイントで切り替える
- 既存デザイントークン（`--primary` グリーン、クリーム背景、`font-heading`、`shadow-soft` 等）を流用し、ダークモードは既存変数で自動追従
- フォーム入力はなく、バリデーション対象はない（遷移リンクのみ）

## データモデル

### 入力

```typescript
// 入力なし（静的な公開ページ）
```

### 出力

```typescript
// データ取得なし。各セクションは props を持たない純粋表示コンポーネント。
// 機能紹介の項目のみ内部定数として保持する。
type LandingFeature = {
  title: string;
  description: string;
  icon: LucideIcon;
};
```

## Supabase

### 使用テーブル

- なし（LP はデータ取得を行わない）

### RLS ポリシー

- 該当なし

### クエリ / Server Action

```typescript
// LP 自体は Server Action / クエリを持たない。
//
// ルーティング制御は lib/supabase/middleware.ts で行う:
// - "/"（完全一致）を公開パスとして扱う（startsWith では全パスが一致するため exact match で判定）
// - ログイン済みかつ pathname === "/" の場合は "/households" へリダイレクト
//
// 公開パス判定はテスト可能な純粋関数として切り出す:
function isPublicPath(pathname: string): boolean // "/", "/login", "/register", "/auth*" を許可
```

### 既存参照の張り替え（`/` → `/dashboard`）

ダッシュボード本体を指していた参照を更新する。

- `app/(dashboard)/page.tsx` → `app/(dashboard)/dashboard/page.tsx` に移動（`/dashboard`）
- `components/features/layout/nav-items.ts`: ホームの `href` と `isNavActive` の判定
- `components/features/layout/app-header.tsx`: ロゴのリンク先
- `app/households/actions.ts`: `redirect("/")` ×2（グループ選択／作成後）→ `/dashboard`

そのまま `/`（＝LP）で良い参照（マーケ/認証文脈のロゴ）:

- `app/(auth)/layout.tsx` のロゴ、`app/households/page.tsx` のロゴ ×3

## テスト方針（TDD）

- Component（Vitest + RTL、ソース同階層）: 各セクションの主要コピー表示、CTA のリンク先（`/register` / `/login`）、6機能ラベル、3ステップ表示
- middleware: 公開パス判定の純粋関数をユニットテスト（`/` は公開、`/dashboard` は保護 等）
- E2E（Playwright）:
  - 未ログインで `/` → LP 表示（`/login` にリダイレクトされない）
  - 「無料で始める」→ `/register`
  - ログイン済みで `/` → `/households`
  - ダッシュボードが `/dashboard` で表示される
- 回帰: `npm run typecheck` / `npm run lint` / `npm run test:run`

## 未解決の課題

- LP に実アプリのスクリーンショットを載せるか（現状は CSS モックで代替）
- OGP 画像・メタデータの最適化（将来対応）
