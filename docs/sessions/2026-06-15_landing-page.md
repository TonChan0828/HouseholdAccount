# 2026-06-15 — ランディングページ（公開トップの新設・ダッシュボードの /dashboard 移動）

## やったこと

- 仕様書 `docs/specs/12_landing_page.md` を作成、CLAUDE.md の一覧に追記
- 実装プラン `docs/superpowers/plans/2026-06-15-landing-page.md` を作成（サブエージェント駆動で実行）
- ルーティング変更:
  - 公開パス判定の純粋関数 `lib/route-access.ts`（`isPublicPath`）を新設（TDD）
  - `lib/supabase/middleware.ts` を更新: `/` を公開化し、ログイン済みで `/` に来たら `/households` へ
  - ダッシュボード index を `app/(dashboard)/page.tsx` → `app/(dashboard)/dashboard/page.tsx` へ移動（`/dashboard`）
  - アプリ内のホーム参照を `/dashboard` に張り替え（`nav-items.ts` / `app-header.tsx` / `households/actions.ts` のリダイレクト・再検証、`scope-toggle.tsx` のリンク）
- 公開ランディングページを実装（`components/features/landing/`、各コンポーネント TDD）:
  - `LandingHeader` / `Hero` / `FeatureBento`（6機能）/ `Steps`（3ステップ）/ `FinalCta` / `LandingFooter`
  - `app/page.tsx` で組み立て＋メタデータ
  - PC=非対称＋ベント、スマホ=中央寄せ縦積みのレスポンシブ（Tailwind `md:` 切り替え）
- E2E をルート移動に追従して更新（`/\/$/` → `/\/dashboard$/`、ログイン済み `goto("/")` → `/dashboard`）。LP表示・ログイン済みリダイレクトのE2Eを追加
- 最終検証: `npm run typecheck` / `npm run lint` / `npm run test:run`（155件）/ `npm run test:e2e`（18件）すべて PASS

## 決めたこと・理由

- `/` を公開LPにし、ダッシュボードは `/dashboard` へ移動（ポートフォリオの入口として自然。ログイン済みは `/households` へ誘導）
- middleware の公開判定は `startsWith` だと `/` が全パスに一致してしまうため、`/` のみ完全一致で判定する純粋関数に切り出してユニットテスト可能にした
- LP は純粋表示コンポーネントに分割し、`app/page.tsx` は組み立てのみ（テスト容易・責務明確）。既存デザイントークンを流用しダークモードに自動追従
- PC=B案 / スマホ=A案 は同一HTMLのブレークポイント切り替えで実現（保守が1本で済む）

## レビューで検出・修正した回帰

- `households/actions.ts` のグループ切替後の `revalidatePath("/")` → `/dashboard`
- `scope-toggle.tsx` のスコープ切替リンク `/?scope=` → `/dashboard?scope=`（＋ユニットテストの期待値も更新）
- LP見出しE2Eの正規表現 `/s` フラグ（tsconfig target 未対応で typecheck エラー）→ `[\s\S]*` に置換

## 次にやること

- `feature/landing-page` を main へ統合（PR）
- デプロイ（Vercel 想定）

## 未解決の課題

- LP に実アプリのスクリーンショットを載せるか（現状は CSS モックで代替）
- OGP 画像・メタデータの最適化
- モバイルでのセクションアンカー（機能/使い方）ナビは未提供（スクロール前提）
