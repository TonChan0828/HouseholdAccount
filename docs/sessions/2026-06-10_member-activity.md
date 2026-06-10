# 2026-06-10 — メンバー別アクティビティの開発

## やったこと

- `docs/specs/07_member_activity.md` を作成（ブレスト→設計承認のうえで作成）
- migration `0009_profiles.sql` を作成しリモートへ適用（profiles テーブル・auth.users INSERT トリガ・バックフィル・RLS・権限硬化）
- `types/database.ts` に profiles / shares_household_with を追記、`types/index.ts` に `Profile` 型を追加
- TDD で `lib/members.ts`（summarizeByMember）→ `MemberActivity` コンポーネント → `/members` ページを実装
- ダッシュボードヘッダーに「メンバー」リンクを追加
- ユニット4件・コンポーネント5件・E2E 1件を追加し、全テスト（Vitest 80件 / Playwright 11件）・typecheck・lint がパス

## 決めたこと・理由

- 表示名は新設の `profiles` テーブルで管理する（auth.users トリガーで自動登録、メールの@前を初期値に）
- 表示名の編集UIは今回のスコープ外（自動生成のみ）
- `/members` は全メンバーのサマリーカード並列表示＋カードクリックでそのメンバーの取引一覧をクライアント展開する構成
- 展開はクライアント状態で行い（リロードなし）、期間ナビは既存の `?ref=` URLパラメータ方式を踏襲する
- 集計は `lib/members.ts` の純粋関数で行いユニットテスト可能にする

## 次にやること

- feature/member-activity を develop へマージ（feature/categories も未マージのため順にマージする）

## 未解決の課題

- 表示名の編集 UI（profiles の UPDATE ポリシー含む）は将来の設定画面で対応する
- Supabase アドバイザリの WARN（SECURITY DEFINER 関数の authenticated 実行可）は既存ヘルパーと同種の意図的なもの
