# 家計簿グループ管理 仕様書

## 概要

家計簿グループ（household）と、そのメンバー（household_members）を管理する。
本フェーズでは **グループの作成・切り替え・招待（トークン方式）の UI / Server Action** を実装する。
（DB スキーマ・RLS・初期化トリガは基盤構築フェーズで確定済み）

メンバー一覧・脱退・削除・オーナー委譲の UI は `15_member_management.md` で実装する。

## 対象ユーザー・前提条件

- ログインユーザーはグループを作成できる（作成者は自動的に `owner` になる）
- メンバー招待（招待リンク発行）・グループ削除は `owner` のみ
- メンバーは自分の脱退（自分の行の削除）が可能
- アクティブグループは Cookie (`active_household_id`) に保存する

## 画面・UI

### 表示内容

- `/households`: 所属グループ一覧（アクティブを強調）＋ グループ新規作成フォーム。
  owner のグループには「招待リンク発行」セクション（人数上限の指定・既存リンクの上限変更・失効）。
- **新規作成フォームの配置**: グループが増えても埋もれないよう、モバイル（lg 未満）では
  一覧の上、デスクトップ（lg 以上）では右レール（7:5 の2カラム・`sticky` でスクロール中も
  常時表示）に置く。コンテナは `lg:max-w-5xl`。フォームは常に DOM に存在する
  （ダイアログにしない＝E2E・キーボード操作の安定性を優先）。
- **グループカードの折り畳み**: メンバー変更・招待・設定は頻度が低いため、カードは
  「グループ名・オーナーバッジ・利用中/切り替え」だけを常時表示し、管理セクション
  （メンバー一覧・月の区切り・招待・削除）は「管理（メンバーN人）」トグルで開閉する
  （`GroupDisclosure`・既定は閉）。一覧の見通しを優先する。開閉はクライアント state のため
  招待発行などの Server Action 再描画では開いたまま維持される（ページ再訪では閉に戻る）。
- **ヘッダー・グループスイッチャー**（全ダッシュボードページ共通）: ロゴ隣に現在のグループ名を
  トリガーとして常設。クリックで所属グループ一覧をドロップダウン表示し、ワンクリックで切り替える。
  アクティブなグループには `Check` を表示し再選択は無効。フッターに `/households`（グループ管理・追加）
  へのリンクを置く。`components/features/layout/household-switcher.tsx`。
- `/invite/[token]`: 招待リンクの参加画面。グループ名を表示し「参加する」で加入。
  期限切れ・上限到達・無効トークンはエラー表示。未ログインは `proxy.ts` で `/login` へ。
- **招待リンクの共有**（新規発行リンク・既存招待の両方の `CopyableLink`）: リンクを外部へ渡す
  手段として以下を提供する。すべて無料の手段（共有 Intent URL / ブラウザ標準 API）で外部キー不要。
  - **コピー**: `navigator.clipboard.writeText`。成功時に「コピー済」を 1.5 秒表示。
  - **LINE**: `https://social-plugins.line.me/lineit/share?url=<encoded>` を別タブで開く。
  - **ネイティブ共有**: `navigator.share` 対応端末でのみボタンを表示し、OS の共有シートを開く
    （X・各種メッセージアプリ等へはここから到達）。`useSyncExternalStore` でクライアント判定し、
    SSR では非表示（hydration 不一致を避ける）。
  - 共有文言は固定の定型文（グループ名は含めない）。

### インタラクション・バリデーション

- グループ名: 1〜100文字
- 招待の人数上限 `max_uses`: 1〜50
- アクティブグループ切り替え時に Cookie を更新する。スイッチャーからの切り替えは
  `revalidatePath("/", "layout")` でレイアウトごと再検証し、今いるページをそのまま新グループの
  データに更新する（リダイレクトしない）。
- 招待リンクは **オープン方式**（リンクを知っているログイン済みユーザーは誰でも参加可能）。
  ただし `max_uses`（owner 指定の人数上限）・有効期限・owner による失効で参加範囲を制御する。
- `max_uses` は発行後も owner が変更可能。上限を下げても既に参加済みのメンバーは外れず、
  以降の新規参加のみを抑止する（`uses_count >= max_uses` で無効化）。

## データモデル

### 入力

```typescript
// types/database.ts の Insert 型
households.Insert         // { name, created_by }
household_members.Insert  // { household_id, user_id, role? }
```

### 出力

```typescript
// types/index.ts
type Household = { id; name; created_by; created_at };
type HouseholdMember = { id; household_id; user_id; role; joined_at };
type Member = HouseholdMember & { email?; display_name? };
type HouseholdInvitation = {
  id; household_id; token; created_by; max_uses; uses_count; expires_at; created_at;
};
```

## Supabase

### 使用テーブル

```sql
households(id, name, created_by, created_at)
household_members(id, household_id, user_id, role['owner'|'member'], joined_at, unique(household_id,user_id))
categories(id, household_id, name, color, icon, type['income'|'expense'|'both'], is_default)
transactions(id, household_id, created_by, amount:int, type['income'|'expense'], category_id, date, memo, created_at)

-- 0004 で追加（本フェーズ）
household_invitations(
  id, household_id, token UNIQUE, created_by,
  max_uses:int CHECK(1..50), uses_count:int DEFAULT 0,
  expires_at timestamptz, created_at
)
```

金額（`amount`）は円建てのため `integer`（小数なし）。

### RLS ポリシー

判定は SECURITY DEFINER 関数で行い、`household_members` の自己参照による無限再帰を回避する。

- `is_household_member(_household_id)` / `is_household_owner(_household_id)`
- 全テーブル select: `is_household_member(household_id)`
- `households`: insert は `created_by = auth.uid()`、update/delete は owner
- `household_members`: insert は owner（招待）、delete は owner または本人（脱退）
- `categories`: 全操作メンバー可
- `transactions`: insert はメンバー かつ `created_by = auth.uid()`、update/delete は `created_by = auth.uid()` のみ
- `household_invitations`: select / insert / update / delete はすべて **owner のみ**
  （参加処理は下記 `accept_invitation` 関数が SECURITY DEFINER で行うため、招待された人は本テーブルへ直接アクセスしない）

### 初期化トリガ

```sql
-- 0003_household_bootstrap.sql
on_household_created (after insert on households):
  1. 作成者を owner として household_members に登録（RLS ブートストラップ回避）
  2. デフォルトカテゴリ（支出9 + 収入3）を付与
```

### 招待参加関数（0004）

```sql
accept_invitation(_token text) returns uuid  -- SECURITY DEFINER
  1. token で household_invitations を検索（無ければエラー）
  2. expires_at 超過 / uses_count >= max_uses ならエラー（無効）
  3. 既に household_members なら何もせず household_id を返す（冪等）
  4. household_members に auth.uid() を member として追加
  5. uses_count を +1
  6. household_id を返す
```

`household_members` の insert ポリシーが owner 限定のため、招待された本人は自分を追加できない。
この関数を SECURITY DEFINER（RLS バイパス）にし、`auth.uid()` で本人確認しつつ、上限判定を
DB 側で原子的に行うことで「想定外の超過参加」を防ぐ。

### クエリ / Server Action

```typescript
// lib/household.ts
getActiveHouseholdId(): Cookie 優先、無ければ所属する最古のグループにフォールバック
getUserHouseholds(): 所属する全グループ {id, name}[] を joined_at 昇順で返す（スイッチャー用）

// app/households/actions.ts（Server Actions）
createHousehold(formData)        // name(1-100) → insert → 新グループを active Cookie に → redirect("/")
setActiveHousehold(householdId)  // メンバー確認 → Cookie set → revalidatePath("/", "layout")
createInvitation(formData)       // owner確認 → token生成(crypto) → insert(max_uses, expires_at=+7d)
updateInvitation(id, max_uses)   // owner のみ → max_uses 更新
revokeInvitation(id)             // owner のみ → delete
acceptInvitation(token)          // rpc("accept_invitation") → 成功時 active Cookie set → redirect("/")
```

## 未解決の課題

- メンバー一覧での auth.users 情報（email/表示名）取得方法（後続フェーズ。Edge Function か admin API 検討）
  - → 15_member_management で profiles / display_name ベースに解決済み
- メンバー一覧・脱退・削除の UI（後続フェーズ）
  - → 15_member_management / 16_household_deletion で実装済み
- ~~招待リンクの multi-user 参加は E2E では関数レベル（SQL）検証に留める~~
  - → 解消済み: 第2ユーザーが招待リンクから参加し脱退する E2E を `e2e/household.spec.ts` に追加
