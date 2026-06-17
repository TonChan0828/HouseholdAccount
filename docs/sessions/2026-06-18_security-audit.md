# 2026-06-18 — システムテスト・セキュリティテスト監査と修正

## やったこと

### 監査（システム/セキュリティテスト）
- 品質ゲートを実行: `typecheck` ✅ / `lint` ✅ / `vitest run`（245→263 tests）✅ / `next build` ✅
- Supabase advisors を取得（security 8 WARN / performance 9 WARN + 3 INFO）
- 手動コードレビュー（middleware・各 Server Action・export route・auth callback・demo store・パスワードポリシー）
- 実装プラン（plan モード）: `/Users/show/.claude/plans/twinkly-snuggling-phoenix.md`

### 修正（TDD + マイグレーション）
- **CSV フォーミュラインジェクション対策**: `lib/export.ts` に `neutralizeFormula` を追加（`= + - @ \t \r` 始まりに `'` を前置）。`lib/export.test.ts` に Red→Green でテスト追加。
- **オープンリダイレクト対策**: `lib/route-access.ts` に `safeNextPath` を追加し `app/auth/callback/route.ts` で適用。`lib/route-access.test.ts` にテスト追加。
- **migration 0014_rls_initplan.sql**: 8 RLS ポリシーの `auth.uid()` → `(select auth.uid())`（advisors `auth_rls_initplan` 解消）。
- **migration 0015_move_helpers_to_private.sql**: SECURITY DEFINER ヘルパー3関数を `private` スキーマへ移動（RPC 公開を除去）。参照する 6テーブル18ポリシーを再作成。

### 検証
- 全マイグレーションを Supabase（project `kykodjgtgrftczofridh`）へ適用
- security advisor: ヘルパー3関数の WARN 解消（残りは意図的 RPC 4件 + leaked-password）
- performance advisor: `auth_rls_initplan` 9件すべて解消（残り INFO 3件のみ）
- RLS スモークテスト（authenticated ロール + ROLLBACK）で「permission denied for function」が出ないことを確認
- `test:run` 263 passed / `next build` OK / **E2E 30 passed**
- 仕様書 `docs/specs/11_security_hardening.md` に監査ラウンドの追加ハードニングを追記

## 決めたこと・理由

- **EXECUTE 剥奪ではなく private スキーマ移動**: 当初プランの「ヘルパー関数の EXECUTE 剥奪」は、これらが RLS ポリシー内部で呼ばれEXECUTE は呼び出しユーザー権限で評価されるため、剥奪すると RLS が権限エラーで壊れると判明。PostgREST が公開しない `private` スキーマへ移し EXECUTE は維持する方式に変更。
- **index 最適化（INFO）は見送り**: ポートフォリオ規模では実害がないため。
- **意図的公開 RPC の WARN は許容**: `accept_invitation` 等は Server Action から呼ぶ設計で、各関数が内部で自己認可するため。

## 次にやること（人間の作業）

- Supabase Auth: Leaked Password Protection を有効化（ダッシュボード）
- 本番 Redirect URL 許可リスト・Vercel 環境変数の確認
- main へ統合（PR）

## 未解決の課題

- CSP は nonce 対応が必要で今回も見送り
- 公開 RPC 4件の WARN は仕様上残置（意図的公開）
