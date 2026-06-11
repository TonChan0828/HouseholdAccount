# 2026-06-11 — ダッシュボードにメンバー別カテゴリマトリクスを追加

## やったこと

- 仕様書 `docs/specs/03_dashboard.md` にメンバー別カテゴリマトリクスを追記
- `lib/category-matrix.ts` — `buildCategoryMemberMatrix` 純関数を TDD で実装（ユニットテスト 8 件）
- `components/features/dashboard/category-member-matrix.tsx` — マトリクス表コンポーネントを TDD で実装（コンポーネントテスト 6 件）
- `app/(dashboard)/page.tsx` — scope フィルタを JS 側に移し、`category_id` 取得・メンバー取得を追加してマトリクスを組み込み
- E2E（`e2e/dashboard.spec.ts`）にマトリクス検証を追加し、全 11 E2E・全 115 ユニット/コンポーネントテストが通ることを確認

## 決めたこと・理由

- マトリクスの軸は 行=カテゴリ / 列=メンバー＋合計列（カテゴリ数 > メンバー数のため縦スクロールに馴染む転置レイアウト）
- 【支出】→【収入】の2セクション構成、合計行＋合計列の両方を表示
- 配置はサマリーカード直下（最近の取引の上）
- マトリクスは scope トグル（全体/自分）の影響を受けず常に全メンバーを表示（メンバー比較が目的のため）
- scope フィルタは DB クエリから JS 側に移し、取引は household_id スコープのみで1回取得（二重フェッチ回避）

## 次にやること

- なし（機能実装・テスト・ドキュメントすべて完了）

## 未解決の課題

- 脱退メンバーの取引はマトリクスから除外されるため、scope=all のサマリー合計とマトリクス総計が乖離し得る
- E2E 実行中のブラウザログに React の duplicate key 警告（UUID キー重複）が出る。auth setup（ログインのみ）の段階でも発生しており今回の変更とは無関係の既存問題。発生箇所の特定と修正は別タスク
  - → 2026-06-12 に解決済み（グループ選択画面の memberships クエリが user_id 未絞り込みだったのが原因。`docs/sessions/2026-06-12_household-membership-duplicate.md` 参照）
