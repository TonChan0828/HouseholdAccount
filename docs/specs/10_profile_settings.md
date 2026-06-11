# 表示名編集（プロフィール設定） 仕様書

## 概要

ログイン中ユーザーが自分の表示名（`profiles.display_name`）を編集できるプロフィール設定画面を追加する。
表示名は登録時にメールアドレスの `@` より前の部分が自動設定されるが（migration 0009 のトリガ）、これまで変更手段がなかった。
`07_member_activity.md` で「将来の設定画面で対応する」とした表示名編集機能の実装にあたる。

## 対象ユーザー・前提条件

- ログイン済みユーザー（`(dashboard)` ルートグループ配下のため認証必須）
- 編集できるのは **自分の表示名のみ**。他メンバーの表示名は閲覧のみ（既存の SELECT ポリシーどおり）
- `profiles` 行は登録時のトリガで必ず作成される前提

## 画面・UI

### 表示内容

- ルート: `/settings`（`app/(dashboard)/settings/page.tsx`）
- ヘッダーのユーザードロップダウンメニューに「プロフィール設定」項目を追加（「カテゴリ管理」の下）し、`/settings` へ遷移する
- ページ内容: Card「プロフィール設定」内に表示名の編集フォーム
  - 「表示名」ラベル付きテキスト入力（初期値: 現在の表示名）
  - 「保存する」ボタン（送信中は「処理中...」で disabled）

### インタラクション・バリデーション

- 表示名: trim 後 1〜20 文字
  - 空・空白のみ → 「表示名を入力してください」
  - 21 文字以上 → 「表示名は20文字以内で入力してください」（入力欄の `maxLength={20}` でも抑止）
- エラーは `role="alert"` でフォーム内に表示
- 成功時はリダイレクトせず同一ページに留まり、`role="status"` で「表示名を更新しました」を表示
- 更新成功後はヘッダー・ダッシュボード・メンバー別アクティビティ等の表示名が再検証される（`revalidatePath("/", "layout")`）

## データモデル

### 入力

```typescript
// lib/validations/profile.ts
const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "表示名を入力してください")
    .max(20, "表示名は20文字以内で入力してください"),
});
type ProfileInput = z.infer<typeof profileSchema>;
```

### 出力

```typescript
// Server Action の状態型
type ProfileActionState = { error: string } | { success: true } | undefined;
```

## Supabase

### 使用テーブル

- `profiles` — `id`（auth.users 参照）, `display_name`, `created_at`

### RLS ポリシー

- 既存: `profiles_select_shared` — 自分自身、または同じ household に属するユーザーの行を SELECT 可能
- **追加（migration 0010）**: `profiles_update_own` — `id = auth.uid()` の行のみ UPDATE 可能（`using` / `with check` とも）
- DB レベルの文字数 CHECK 制約は設けない。登録トリガがメールの local part（20 文字超になりうる）を初期値とするため、制約を追加すると既存トリガ・バックフィル済みデータと衝突しうる。文字数制御はアプリ層（Zod）のみで行う

### クエリ / Server Action

```typescript
// app/(dashboard)/settings/actions.ts
async function updateProfile(prevState, formData) {
  // 1. profileSchema.safeParse → 失敗なら { error }
  // 2. auth.getUser() → null なら redirect("/login")
  // 3. profiles.update({ display_name }).eq("id", user.id) → 失敗なら { error: "表示名の更新に失敗しました" }
  // 4. revalidatePath("/", "layout")
  // 5. return { success: true }
}
```

## 未解決の課題

- E2E は共有ユーザー（`e2e@e2etest.dev`）の表示名を変更するため、テスト末尾で必ず "e2e" に復元する。`members.spec.ts` が表示名 "e2e" に依存しており、`fullyParallel: true` のローカル並列実行では稀に競合しうる（flake が頻発する場合は直列化を検討）
- `profiles` 行が存在しない場合（理論上トリガで常に存在）、UPDATE は 0 行更新でも成功扱いになる
- アバター画像・メールアドレス変更などプロフィールの他項目は本仕様のスコープ外
