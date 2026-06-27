# 2026-06-27 — 収支のグループ間反映機能

## やったこと

- 機能仕様書 `docs/specs/28_cross_group_reflection.md` を作成（CLAUDE.md の spec 一覧にも追記）。
- 純関数 `lib/transactions/mirror.ts#buildMirrorRows` を TDD で実装（`mirror.test.ts` 7 ケース）。カテゴリ照合は `lib/import/excel.ts#splitCategoryNames` を再利用。
- `app/(dashboard)/transactions/actions.ts` に `mirrorTransaction` ヘルパー・`reflectTransaction` アクションを追加し、`createTransaction` を反映対応に拡張。
- `transaction-form.tsx` に `otherHouseholds` prop と「他のグループにも反映」開閉セクションを追加。`new/page.tsx` で反映先候補を渡す。
- 編集画面用クライアント `reflect-to-groups.client.tsx` を新設し、`[id]/edit/page.tsx` に組み込み。
- E2E `e2e/cross-group-reflection.spec.ts` を追加（登録フォーム同時反映・編集画面からの後追い反映の2ケース）。一時グループを2つ動的作成するためシード変更は不要。
- 検証: `npm run typecheck` / `lint` / `test:run`（454 件 green）/ `build` / 新規 E2E（3 passed）すべて成功。

## 決めたこと・理由

- **一回限りのコピー**方式（リンク同期しない）→ DB スキーマ変更不要・実装が単純。
- **カテゴリは名前+type 一致で紐付け、無ければ未分類**（CSV インポートの照合ロジックを再利用）。新規作成はしない。
- **反映先は本人の所属全グループ**（反映元を除く）。サーバー側で所属検証し不正 ID は除外。
- トリガーは**新規登録フォーム**と**既存収支からの後追い**の両方を提供。

## 次にやること

- （任意）反映先カテゴリが同名一致したケースの分析画面での見え方確認。
- （任意）コミット。

## 未解決の課題

- 反映元の編集/削除は反映先に伝播しない（将来課題）。
- 後追い反映の繰り返しで重複コピーが起きうる。
