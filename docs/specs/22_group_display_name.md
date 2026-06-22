# グループ毎の表示名（ニックネーム） 仕様書

## 概要

ユーザーがグループ（家計簿）ごとに別の表示名（ニックネーム）を設定できるようにする。
これまで表示名は `profiles.display_name`（ユーザー1人につき1つのグローバル名・spec 10）で、全グループ共通だった。
家計簿は「家族用」「友人用」など複数グループで使われ得るため、グループ単位で名前を変えたいケースに対応する。

グループ毎の名前は **任意**。未設定のグループでは従来どおりグローバル表示名にフォールバックするため、既存挙動は壊さない。

## 対象ユーザー・前提条件

- ログイン済みユーザー
- 編集できるのは **自分自身のグループ毎の名前のみ**。owner が他メンバーを改名する機能は対象外（既存 SELECT ポリシーどおり閲覧は可能）
- `household_members` 行は所属時に必ず存在する前提

## 画面・UI

### 編集（グループ一覧ページ `/households`）

- 各グループの「メンバー」一覧（`MemberList`）で、**自分の行**に「ニックネーム編集」ボタンを追加
- クリックでインライン入力フォームを表示（既存の確認操作 UI と同じ作法）
  - テキスト入力（`maxLength=20`、初期値: そのグループの現在のニックネーム。未設定なら空）
  - 「保存」ボタン／「キャンセル」ボタン
  - **空のまま保存するとニックネームを解除**し、グローバル表示名にフォールバック
- 保存後は `revalidatePath("/", "layout")` でメンバー一覧・ヘッダー・関連画面の表示名が再検証される

### 表示（フォールバック）

表示名の解決順は全画面共通:

```
household_members.display_name（グループ毎の名前） → profiles.display_name（グローバル名） → "不明なユーザー"
```

反映先:
- `/households` のメンバー一覧
- ヘッダー右上のユーザー名（**利用中グループのニックネームを反映**。未設定ならグローバル名）
- `/members`（メンバー別アクティビティ）
- ダッシュボードのメンバー別表示
- 収支 CSV エクスポートの登録者名

## データモデル

### DB（migration 0017_member_display_name）

- `household_members.display_name`（`text`, **nullable**）を追加。NULL = フォールバック
- `set_member_display_name(_household_id uuid, _display_name text)` RPC（`SECURITY DEFINER`）で
  呼び出し元自身の行の `display_name` のみ更新（`nullif(btrim(...), '')` で空文字は NULL に正規化）

### 入力（バリデーション）

```typescript
// lib/validations/profile.ts
const groupDisplayNameSchema = z.object({
  displayName: z.string().trim().max(20, "表示名は20文字以内で入力してください"),
  // 空文字を許可（= ニックネーム解除）。min は設けない。
});
```

### 出力

```typescript
// app/households/actions.ts — 既存 SimpleAction と同じく void を返す
async function updateGroupDisplayName(formData: FormData): Promise<void>;
```

## Supabase

### 使用テーブル

- `household_members` — `display_name`（新規・nullable）を追加

### RLS / RPC

- 既存 `members_update_owner` は **owner のみ** UPDATE 可能なため、member が自分の行を直接更新できない
- RLS を緩めると列を限定できず member の role 自己昇格リスクがあるため、`display_name` のみ更新する
  `SECURITY DEFINER` RPC `set_member_display_name` を採用（`transfer_ownership`(0013) / `delete_own_account`(0012) と同じ作法）
- RPC は内部で `auth.uid()` を使い、呼び出し元自身の行に対してのみ更新する（他人の行は更新不可）

## 未解決の課題

- ニックネームに DB レベルの文字数 CHECK は設けず、文字数制御はアプリ層（Zod）のみ。`set_member_display_name` 側で長すぎる値もそのまま保存しうるため、必要なら RPC 内に長さ検証を追加する余地あり
- owner による他メンバーの改名はスコープ外
- グローバル表示名（`profiles.display_name` / `/settings`）は引き続きフォールバック元として維持
