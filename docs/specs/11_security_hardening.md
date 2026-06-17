# セキュリティハードニング 仕様書

## 概要

デプロイ前に実施するセキュリティ確認・改善。UI 上の新機能は追加せず、認可の多層防御・Cookie 属性・HTTP セキュリティヘッダーを強化し、DB（Supabase advisors）と依存パッケージ（npm audit）を点検する。

### 脅威モデルと対応

| 重要度 | 脅威 | 現状 | 対応 |
| --- | --- | --- | --- |
| 高 | Cookie `active_household_id` の改ざんによる非所属グループの指定 | RLS が唯一の防壁（getActiveHouseholdId は Cookie を無検証で信頼） | Cookie の値が自分の所属グループか `household_members` で検証し、非所属なら最古の参加グループにフォールバック |
| 中 | `updateTransaction` / `deleteTransaction` の認可が RLS 頼み | `id` のみで UPDATE/DELETE（認証チェックなし） | 認証チェック + `household_id` スコープを追加（多層防御） |
| 中 | HTTP 経由での Cookie 漏えい | `secure` フラグなし | 本番環境で `secure: true` |
| 中 | クリックジャッキング・MIME スニッフィング等 | セキュリティヘッダー未設定 | `next.config.ts` で共通ヘッダーを付与 |

## 対象ユーザー・前提条件

- 全ユーザー（挙動変更なし。正規操作では従来どおり動作する）
- 攻撃者モデル: 正規アカウントを持つログイン済みユーザーが Cookie やリクエストを改ざんするケース

## 画面・UI

### 表示内容

- UI 変更なし。Cookie が非所属グループを指す場合は所属グループ（最古）のデータが表示される（従来は空表示や RLS エラーになり得た）

### インタラクション・バリデーション

- `updateTransaction` / `deleteTransaction` で対象が見つからない（他人の取引・他グループの取引）場合はエラーを返し、何も変更しない

## データモデル

### 入力

```typescript
// 変更なし（既存の transactionSchema を継続使用）
```

### 出力

```typescript
// getActiveHouseholdId(): Promise<string | null>
// — Cookie の値が所属グループの場合のみその ID を返す。
//   非所属・未設定なら最古の参加グループの ID、未所属なら null。
```

## Supabase

### 使用テーブル

- `household_members` — Cookie の household_id のメンバーシップ検証に使用
- `transactions` — UPDATE / DELETE に `household_id` スコープを追加

### RLS ポリシー

- 変更なし（既存ポリシーは点検済みで妥当）。アプリ層の検証は RLS の手前の多層防御として追加する
- `mcp__supabase__get_advisors` の指摘があればマイグレーションで対応

### クエリ / Server Action

```typescript
// lib/household.ts — getActiveHouseholdId
// Cookie の値を household_members で検証してから返す
const { data } = await supabase
  .from("household_members")
  .select("household_id")
  .eq("user_id", user.id)
  .eq("household_id", fromCookie)
  .maybeSingle();

// app/(dashboard)/transactions/actions.ts — updateTransaction / deleteTransaction
// 認証チェック + household スコープを追加
await supabase
  .from("transactions")
  .update({ ... })
  .eq("id", id)
  .eq("household_id", householdId);
```

### セキュリティヘッダー（next.config.ts）

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

## 追加ハードニング（2026-06-18 監査ラウンド）

システムテスト・セキュリティテストの結果に基づく追加対応。

| 重要度 | 脅威 | 現状 | 対応 |
| --- | --- | --- | --- |
| 中 | CSV フォーミュラインジェクション | `escapeCsvField` は RFC4180 クオートのみで `= + - @` 始まりの値を無害化していない | `memo`・カテゴリ名・登録者名が `= + - @ \t \r` で始まる場合、先頭に `'` を付与して無害化（`lib/export.ts` `neutralizeFormula`） |
| 低 | オープンリダイレクト | `auth/callback` の `next` パラメータが未検証 | 単一スラッシュ始まりの相対パスのみ許可する `safeNextPath`（`lib/route-access.ts`）を通す。`//`・`/\`・絶対 URL は既定値へフォールバック |
| 低 | SECURITY DEFINER ヘルパーの RPC 公開 | `is_household_member` / `is_household_owner` / `shares_household_with` が `public` にあり `/rest/v1/rpc/...` で直接実行可能 | `private` スキーマへ移動し RPC エンドポイントを除去（migration 0015）。RLS 評価に必要なため `authenticated` の EXECUTE は維持（EXECUTE 剥奪は RLS を壊すため不可） |
| 低(Perf) | RLS の `auth.uid()` 行ごと再評価 | 8 ポリシーが該当（advisors `auth_rls_initplan`） | `auth.uid()` → `(select auth.uid())`（migration 0014） |

### マイグレーション
- `0014_rls_initplan.sql` — RLS ポリシーの `auth.uid()` を `(select auth.uid())` に置換（挙動等価）
- `0015_move_helpers_to_private.sql` — ヘルパー3関数を `private` スキーマへ移し、参照する全 RLS ポリシー（6テーブル18ポリシー）を再作成

### advisors の残課題（仕様上の意図的公開・人手対応）
- `accept_invitation` / `delete_own_account` / `invitation_preview` / `transfer_ownership` は Server Action から呼ぶ意図的な公開 RPC。各関数が内部で自己認可するため WARN は許容
- Leaked Password Protection（HaveIBeenPwned 照合）は Supabase ダッシュボードで有効化する（コードでは変更不可）

## 未解決の課題

- CSP（Content-Security-Policy）は Next.js のインラインスクリプトとの相性問題（nonce 対応が必要）のため今回は見送り
- npm audit の moderate 以下の指摘は記録のみで対応しない
- パフォーマンス INFO（FK 未インデックス×2・未使用インデックス×1）は影響軽微のため見送り
