# 2026-09-27 — 既存カテゴリ重複の安全な統合

## 方針

- 予算が複数ある重複カテゴリは、金額を合算・破棄せず、そのまま残して要確認とする。
- 名前（表記も含む）・色・icon・default 属性・通知設定が異なる場合も、自動では選択せず残す。
- household・種別・名前・表示属性が完全一致し、予算が0〜1件の重複に限り、ID の小さいカテゴリへ参照を集約する。

## 変更

- migration `20260927110000_0029_merge_safe_legacy_duplicate_categories.sql` を追加。
- `transactions`、`recurring_transactions` の参照と、単一の `budgets` 行を保持カテゴリへ付け替えてから重複カテゴリを削除する。
- 曖昧な重複グループは変更しない。migration は統合件数と、要確認として残る正規化名の重複グループ数を NOTICE に出す。
- pgTAP で参照維持、複数予算・異なる色・異なる表記・異なる種別の保護、再実行時の冪等性を確認する。

## 検証

- `supabase/tests/database/legacy_category_duplicate_merge.sql` を追加。
- ローカルの Docker daemon が起動していないため、ローカル DB テストは未実行。PR の Database workflow で検証する。
