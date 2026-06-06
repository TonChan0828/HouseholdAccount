# 2026-06-06 — 基盤構築（Next.js + Supabase 認証 + DBスキーマ）

## やったこと

- Next.js 16 (App Router) + TypeScript + Tailwind v4 でスキャフォールド
- shadcn/ui (base-nova) を初期化し、基盤コンポーネントを追加
- Vitest（jsdom + Testing Library）と Playwright のテスト基盤を構築
- `@supabase/ssr` で browser/server クライアントと `proxy.ts`（旧 middleware）を実装
- DB スキーマ・RLS・初期化トリガのマイグレーションを作成（全4テーブル）
- zod バリデーション（TDD）→ ログイン/登録/ログアウトの Server Actions と画面を実装
- 認証ルーティングの E2E テストを追加
- 仕様書（00_overview / 01_auth / 06_household）とセッションログを作成
- 検証: typecheck / lint / vitest 緑、`next build` 成功、未認証リダイレクトを curl で確認

## 決めたこと・理由

- Supabase は**クラウドプロジェクト**を使用（ポートフォリオ公開向け）
- DB スキーマは**全テーブル一括**で作成（RLS が相互参照するため）
- `household_members` の RLS 再帰は **SECURITY DEFINER 関数**で回避
- グループ作成時に**作成者を owner 登録＋デフォルトカテゴリ付与**するトリガで RLS ブートストラップ問題を解消
- 金額は円建てのため `integer`（小数なし）
- Next 16 で `middleware` が非推奨のため **`proxy.ts`** 規約に移行
- 認証は `react-hook-form` ではなく **Server Actions + `useActionState`**（base-nova に form コンポーネントが無いため）

## 次にやること

- Supabase クラウドプロジェクト作成 → `.env.local` 設定 → マイグレーション適用
- 適用後 `supabase gen types` で `types/database.ts` を再生成
- 家計簿グループの作成・招待・切り替え UI（次フェーズ）

## 未解決の課題

- メール確認有効時の登録後遷移分岐
- メンバー一覧での auth.users 情報（email/表示名）取得方法
- 実 Supabase 接続でのログイン/登録 E2E
