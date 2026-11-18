# 2026-11-18 — カテゴリ削除が永続化されない不具合の修正

## 報告

- `/categories` でカテゴリを削除すると一覧から消えるが、再読み込みすると元に戻る。エラーは表示されない。

## 調査

- `deleteCategory` は `error` が無ければ成功として扱っていた。PostgREST の DELETE は条件に合う行が 0 件でもエラーを返さないため、何も削除されなくても redirect していた。
- 「医療費」はデフォルトカテゴリで、`is_default=false` の条件により必ず 0 件になる。
- 報告にあるダイアログ「カテゴリを削除しますか？」と楽観的更新は、このリポジトリのどのコミットにも存在しない。本番 DB は Supabase MCP の認証エラーで確認できなかった。

## 変更

- `deleteCategory` を `useActionState` 形式にし、`.select("id")` で削除行を受け取って 0 件と DB エラーを失敗として返すようにした。成功時は `revalidatePath("/", "layout")` のうえ `/categories?deleted=1` へ遷移する。
- `DeleteCategoryButton` を `window.confirm` から確認ダイアログに変えた（`DeleteTransactionButton` と同じ作り）。失敗はダイアログ内に `role="alert"` で表示する。
- `/categories` に削除成功の通知を追加した。デモモードも新しいシグネチャに合わせた。

## 検証

- `npm run test:run`: 129 ファイル・950 件すべて通過。`npm run lint`・`npm run typecheck` も通過。
- `npx playwright test --workers=1`: 77 件中 76 件通過。追加した削除シナリオは通過した。
- 失敗した 1 件「通知ONにしたカテゴリの登録漏れ…」は `response.finished()` で 30 秒のタイムアウトになる。今回の変更を退避した main の状態でも同じく失敗するため、既存の問題として別途調査する。

## 未解決

- 報告にあった 2 つのカテゴリ ID の本番 DB での状態（`is_default`・`household_id`）は、Supabase MCP の認証エラーで確認できていない。
- `next dev` が `AGENTS.md` を自動で書き換える。今回のコミットには含めていない。
