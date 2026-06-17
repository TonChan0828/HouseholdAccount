# E2Eテストデータライフサイクル 仕様書

## 概要

E2E（Playwright）テストの実行で生成されるグループ・収支・カテゴリなどのデータが
Supabase に蓄積し続ける問題を解消する。

各テストは衝突回避のため `E2E分析-${Date.now()}` のようなタイムスタンプ付きの名前で
データを新規作成するが、作成のみのテスト（dashboard / analytics / members / household切替 など）は
後始末をしないため、実行のたびにゴミデータが残り続けている。

本機能では **接頭辞分離方式** を採用し、テストが生成する一時データに専用の接頭辞を付与する。
E2E 実行の**開始時**（`globalSetup`）に、その接頭辞を持つデータのみをまとめて削除する。
これにより、

- seed 済みの固定フィクスチャ（`MULTI_MEMBER_HOUSEHOLD` 等）を誤って削除しない
- 前回の実行が途中で落ちても、次回の開始時クリーンアップで確実に掃除される

ことを保証する。

### なぜ「終了後」ではなく「開始時」か

- **クラッシュ耐性**: `afterEach` / `afterAll` はテストが例外で停止するとスキップされ、ゴミが残る。
  開始時クリーンアップは前回の残骸も必ず掃除する。
- **失敗調査**: 失敗直後にデータを消さないため、残骸を見て原因を追える。
- **決定的な初期状態**: 毎回まっさらな状態から開始できる。

## 対象ユーザー・前提条件

- 対象: 開発者（CI / ローカルで E2E を実行する人）。アプリのエンドユーザーには影響しない。
- 前提:
  - Supabase に seed 済みの固定フィクスチャが存在する（削除してはならない）。
    - `E2E_USER`（`e2e@e2etest.dev`、owner）
    - `E2E_MEMBER_USER`（`e2e-member@e2etest.dev`、member）
    - `MULTI_MEMBER_HOUSEHOLD`（`"E2Eダッシュボード-1781044939636"`）
  - クリーンアップには RLS を越えて削除できる **Supabase service-role キー**が必要。
    `.env.test`（または CI シークレット）から読み込み、ブラウザバンドルには絶対に含めない。

## 画面・UI

本機能はテスト基盤の変更であり、アプリ UI への変更はない。

### 表示内容

- なし（UI 変更なし）

### インタラクション・バリデーション

- なし

## データモデル

### 一時データの接頭辞規約

テストが生成するすべての一時データ（グループ名・カテゴリ名・メモ等のうち、命名で識別するもの）は
専用の接頭辞を先頭に付与する。

```typescript
// e2e/constants.ts
/** E2E が生成する一時データに付与する接頭辞。クリーンアップの識別子を兼ねる。 */
export const E2E_EPHEMERAL_PREFIX = "__e2e_tmp_";

/** タイムスタンプ付きの一時グループ名などを生成するヘルパー */
export function ephemeralName(label: string): string {
  return `${E2E_EPHEMERAL_PREFIX}${label}-${Date.now()}`;
}
```

- seed 済みフィクスチャ（`MULTI_MEMBER_HOUSEHOLD` など）はこの接頭辞を**持たない**ため、
  クリーンアップ対象から自動的に除外される。
- 既存テストの `E2E分析-${stamp}` 等は `ephemeralName("分析")` 形式へ置き換える。

### 入力

```typescript
// globalSetup が参照する環境変数
interface E2ECleanupEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string; // RLS を越えて削除するため service-role が必須
}
```

### 出力

```typescript
// クリーンアップ結果（ログ出力用、戻り値の型イメージ）
interface CleanupResult {
  deletedHouseholds: number;
  // transactions / categories は household への ON DELETE CASCADE で連鎖削除される想定
}
```

## Supabase

### 使用テーブル

- `households` — 接頭辞付きグループの削除対象
- `transactions`, `categories`, `household_members` — `household_id` への
  `ON DELETE CASCADE`（`0001_initial_schema.sql`）で連鎖削除される（確認済み）

### RLS ポリシー

- 変更なし。クリーンアップは **service-role キー**で RLS をバイパスして実行する。
  通常のアプリ動作・テスト本体は引き続き RLS 配下で動く。

### クエリ / Server Action

クリーンアップは Server Action ではなく、Playwright の `globalSetup` から
service-role クライアントで直接実行する。

```typescript
// e2e/global-setup.ts（実装）
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { isEphemeralName } from "./constants";

export default async function globalSetup() {
  loadEnvConfig(process.cwd()); // Playwright は Next の env を自動で読まない
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // 未設定なら明示エラーで停止
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // SQL の LIKE は `_` がワイルドカードになり誤マッチするため使わない。
  // 全グループを取得し、ユニットテスト済みの isEphemeralName で厳密に判定する。
  const { data } = await admin.from("households").select("id, name");
  const targets = (data ?? []).filter((h) => isEphemeralName(h.name));
  if (targets.length > 0) {
    await admin.from("households").delete().in("id", targets.map((h) => h.id));
    // transactions / categories / household_members は ON DELETE CASCADE で連鎖削除
  }
}
```

`playwright.config.ts` に `globalSetup: "./e2e/global-setup.ts"` を追加する。
あわせて、`*.test.ts`（Vitest 用）を Playwright が拾わないよう `testIgnore` を設定し、
Vitest 側は `e2e/**/*.spec.ts`・`e2e/**/*.setup.ts` のみ除外して `e2e/*.test.ts` を拾う。

## 未解決の課題

- **service-role キーの管理（要対応）**: `SUPABASE_SERVICE_ROLE_KEY` をローカル
  `.env.local` と CI シークレットに設定する必要がある。未設定だと globalSetup が
  明示エラーで停止する（クリーンアップを黙ってスキップしないための設計）。
  `.env*` は `.gitignore` 済み・`.env.example` に記載済み。

### 解決済み

- **CASCADE の有無**: `households` への FK は `transactions` / `categories` /
  `household_members` すべて `ON DELETE CASCADE`（`0001_initial_schema.sql`）。
  グループ削除で連鎖削除されるためマイグレーション不要。
- **LIKE のワイルドカード**: 接頭辞 `__e2e_tmp_` の `_` が SQL LIKE のワイルドカードに
  なる問題は、`.like()` を使わず取得後に `isEphemeralName` で JS フィルタすることで回避。
- **並列実行**: `fullyParallel: true` でも globalSetup は全 worker 起動前に 1 回だけ走る。
  実行途中に生成されるデータは当該実行中は残り、次回開始時に回収される。
- **CRUD 削除テストの方針**: 開始時クリーンアップ前提でも、削除フロー自体を検証する
  テスト（transactions / categories / household 削除）は従来どおり自テスト内の
  削除アサーションを残す。
