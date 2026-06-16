# メンバー管理 仕様書

## 概要

家計簿グループ（household）に参加しているメンバー（household_members）を、グループ画面から
**閲覧・管理** できるようにする。`06_household.md` で「後続フェーズ」とした
メンバー一覧・除外・脱退・オーナー委譲の UI / Server Action を本フェーズで実装する。

DB スキーマ・RLS（`members_delete_owner_or_self` / `members_update_owner`）は基盤構築フェーズで
確定済みで、本フェーズはそれを呼び出す UI・アクションと、委譲用の RPC を追加する。

## 対象ユーザー・前提条件

- メンバー一覧は、そのグループに所属する全メンバーが閲覧できる（RLS の select はメンバー全員）
- **オーナーによる除外**: `owner` は自分以外のメンバーをグループから外せる
- **自分で脱退**: `member` は自分の意思でグループから抜けられる
- **オーナー委譲**: `owner` は同じグループの別メンバーへオーナーを譲れる（自分は `member` に降格）
- **owner の脱退は委譲必須**: owner は別メンバーへ委譲してからでないと脱退できない（誤ってグループを
  オーナー不在にしないため）

## 画面・UI

`/households` の各グループカード内に「メンバー」セクションを追加する（全メンバーに常時表示）。

### 表示内容

- メンバーごとに **表示名**（`profiles.display_name`、無ければ「不明なユーザー」）・
  **オーナーバッジ**（role=owner）・**「あなた」バッジ**（自分の行）・**参加日** を表示する。
- 閲覧者が `owner` の場合、自分以外の各メンバー行に「オーナーを委譲」「除外」を表示する。
- 自分の行: `member` なら「脱退」、`owner` なら脱退ボタンは出さず
  「委譲してから脱退できます」と案内する。
- 月の区切り・招待リンク発行セクションは従来どおり `owner` のみに表示する。

### インタラクション・バリデーション

- **除外・委譲・脱退はいずれも確認ステップを挟む**（クリック→確認文＋実行/キャンセル）。
  ネイティブ `confirm()` は使わず DOM 内の2段階確認とする（E2E で扱いやすく、トーストやダイアログ
  コンポーネント追加も不要）。`components/features/household/member-list.tsx`。
- 除外: `removeMember`（自分自身は対象外。RLS が owner 以外を弾く）。
- 脱退: `leaveHousehold`（owner はエラー文言を返して止める＝委譲必須）。脱退グループがアクティブ
  Cookie と一致すれば Cookie を消し、`getActiveHouseholdId()` が残りグループへフォールバックする。
- 委譲: `transferOwnership`（RPC `transfer_ownership` を呼ぶ）。

## データモデル

新規テーブルは追加しない。一覧表示用に `household_members` 行へ `profiles.display_name` を結合する
（`/members` ページと同じ手法）。

```typescript
// components/features/household/member-list.tsx
type MemberListItem = {
  user_id: string;
  display_name: string;
  role: "owner" | "member";
  joined_at: string;
  isSelf: boolean;
};
```

## Supabase

### RLS ポリシー（既存・本フェーズで利用）

- `members_delete_owner_or_self`（0002）: delete は `is_household_owner(household_id) or user_id = auth.uid()`。
  → 除外（owner→他メンバー）・脱退（本人）の両方をこれ1本で満たす。
- `members_update_owner`（0002）: update は owner のみ（委譲の role 更新に利用）。

### オーナー委譲 RPC（0013 で追加）

```sql
transfer_ownership(_household_id uuid, _new_owner uuid) returns void  -- SECURITY DEFINER
  1. auth.uid() が当該グループの owner か検証（違反で例外）
  2. _new_owner が同グループのメンバーか・自分自身でないか検証（違反で例外）
  3. _new_owner を role='owner' に昇格
  4. 呼び出し元を role='member' に降格（単一オーナーを維持）
  5. households.created_by を _new_owner へ張り替え（delete_own_account の委譲ロジックと整合）
  権限: anon から revoke、authenticated に grant（0007 / 0012 と同方針）
```

複数行を原子的に更新する必要があり、降格で自分が owner でなくなる過程の RLS WITH CHECK 評価順に
依存したくないため、`delete_own_account()`（0012）と同じく SECURITY DEFINER 関数として実装する。

## Server Actions（`app/households/actions.ts`）

- `removeMember(formData)`: `household_id` + `user_id`(対象)。自分自身はガードで除外。`/households` を再検証。
- `leaveHousehold(prevState, formData)`: `household_id`。owner はエラー返却、member は自分の行を削除し
  アクティブ Cookie をクリアして `/households` へリダイレクト。
- `transferOwnership(formData)`: `household_id` + `user_id`(新 owner)。RPC を呼び `/households` を再検証。

## テスト

- Unit/Component: `member-list.test.tsx`（一覧描画・owner/member での操作出し分け・確認ステップ）。
- E2E（`e2e/household.spec.ts`）: 単独オーナーのグループでメンバー一覧に自分が表示され、脱退ボタンが
  出ず委譲案内が出ること（非破壊）。
- DB シミュレーション（ROLLBACK）: `transfer_ownership` の委譲結果・3つのガード、および
  `members_delete_owner_or_self` の除外/脱退/他人削除拒否を実データで検証（共有 Supabase を汚さない）。

## 未解決の課題

- 単独 owner の脱退＝実質グループ削除は **`16_household_deletion.md` で実装済み**（owner はカードの
  「グループを削除」から削除する）。これに伴い member-list の「委譲してから脱退できます」注記は
  **他メンバーがいる場合のみ**表示する。
- 複数 owner は許容しない（委譲＝単一オーナーのスワップ）。
- 2人以上の実メンバーを要する破壊的 E2E（実除外・実委譲・実脱退）は、E2E ユーザーが1名・共有 DB の
  ため未追加。代わりに DB シミュレーション（ROLLBACK）で多層検証する（`14_account_deletion.md` と同方針）。
