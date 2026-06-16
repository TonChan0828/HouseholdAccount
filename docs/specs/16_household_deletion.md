# グループ削除 仕様書

## 概要

家計簿グループ（household）の**オーナーが、自分がオーナーのグループを削除**できる機能。
`15_member_management.md` で本スコープ外とした「単独 owner の脱退＝実質グループ削除」を解消する。

- 対象は **owner が所有する任意のグループ**（単独メンバーに限定しない）。他メンバーがいる
  グループも削除でき、その場合は他メンバーの共有データ（取引・カテゴリ）も消える。
- 削除は不可逆。実行前に**モーダル（ポップアップ）で再確認**する。

## 対象ユーザー・前提条件

- グループの削除は `owner` のみ（RLS `households_delete_owner`）。
- 子テーブル（`household_members` / `transactions` / `categories` / `household_invitations`）は
  すべて `references households(id) on delete cascade`。→ グループ行の削除で連鎖削除される。
- **マイグレーション不要**（DB は基盤構築フェーズで対応済み）。

## 画面・UI

`/households` の各グループカード内、owner の `CardContent`（招待セクションの下）に
「危険な操作」セクションを追加し、`DeleteHouseholdDialog`
（`components/features/household/delete-household-dialog.tsx`）を置く。

- 「グループを削除」ボタン（`variant="destructive"`）→ クリックで確認モーダルを開く。
- モーダル本文: 「『〈グループ名〉』とそのすべての取引・カテゴリが完全に削除され、元に戻せない」旨。
  メンバーが2人以上のときは「あなた以外の N 人のメンバーのデータも削除されます」を強調表示。
- フッター: 「キャンセル」（モーダルを閉じる）と「削除する」（destructive・`<form action>` で submit）。
- ダイアログは `components/ui/dialog.tsx`（`npx shadcn@latest add dialog`、base-nova/Base UI）。
  **`open` を `useState` で制御**する（render-prop トリガーより堅牢で、ブラウザ・テスト双方で確実に開く）。

## データモデル

新規テーブル・カラムなし。`DeleteHouseholdDialog` に渡すのは
`householdId` / `householdName` / `memberCount`（警告の出し分け用）と削除アクション。

## Supabase

- RLS `households_delete_owner`（`0002`）: `for delete using (is_household_owner(id))`。
- CASCADE: `0001`（household_members / categories / transactions）・`0004`（household_invitations）。

## Server Action（`app/households/actions.ts`）

- `deleteHousehold(formData)`:
  - `household_id` を受け取る。未ログインは `/login`。
  - 防御的に呼び出し元が owner か確認（RLS でも owner 以外は 0 行）。
  - `from("households").delete().eq("id", householdId)` → CASCADE で連鎖削除。
  - 削除グループがアクティブ Cookie と一致すれば `ACTIVE_HOUSEHOLD_COOKIE` を消す
    （`getActiveHouseholdId()` が残りグループへフォールバック）。
  - `revalidatePath("/", "layout")` → `redirect("/households")`。戻り値は `void`。

## テスト

- Component（`delete-household-dialog.test.tsx`）: トリガーでモーダルが開く・`memberCount>1` のとき
  他メンバー警告が出る/=1では出ない・hidden `household_id`・キャンセルで閉じる。
- E2E（`e2e/household.spec.ts`）: グループ作成 → 確認モーダル → 「削除する」→ 一覧から消える
  （**使い捨てグループへの破壊的操作なので安全**）。単独オーナーのカードに削除導線が出ることも検証。
- DB シミュレーション（ROLLBACK）: 複数メンバーのグループを owner として削除し、子テーブル4種が
  CASCADE で 0 件になることを実データで確認。
- ブラウザ手動確認（Playwright MCP）: モーダルが開き「削除する」で `deleteHousehold` が走り一覧から消える。

## 未解決の課題

- ソフトデリート・ゴミ箱は設けない（即時・不可逆。`14_account_deletion.md` と同方針）。
- 確認はモーダル内の単一ボタン（グループ名タイプ要求はしない）。誤操作防止はモーダルのワンクッションで担保。
