# アーキテクチャ・データ境界強化 仕様書

## 概要

既存の画面・URL・データを維持しながら、Supabase のデータ整合性、RLS、定期収支生成、
データ取得時の障害処理、継続的検証を実運用を意識した水準へ引き上げる。
全面再構築は行わず、既存の Server Component + Server Action + RLS 構成を強化する。

## 利用者に見える動作

- 既存の画面、URL、フォーム操作は維持する。
- 収支一覧は大量データでも欠落しないよう、表示を50件単位でページングする。
- DB 障害は「データなし」として表示せず、再試行可能なエラー画面を表示する。
- 存在しない編集対象は一覧へ戻すのではなく 404 として表示する。
- 定期収支は画面閲覧ではなく、毎日のスケジュール処理で当期分を冪等生成する。

## データモデル・RLS

- `transactions` / `recurring_transactions` の UPDATE・DELETE は、登録者本人かつ
  対象グループの現メンバーだけを許可する。
- `transactions` / `recurring_transactions` / `budgets` のカテゴリは、行と同じ
  `household_id` のカテゴリだけを参照できる複合外部キーで保証する。
- 既存の異常なカテゴリ参照は、取引・定期収支では NULL、予算では行削除に正規化する。
- 金額、メモ長、貯金目標名・期日についてアプリと同等の DB CHECK を追加する。
- 全グループの定期収支を指定日基準で生成する `generate_all_due_recurring(date)` を追加し、
  `service_role` だけに EXECUTE を許可する。

## アプリケーション境界

- `lib/queries` の予期しない Supabase エラーは `DataAccessError` として送出する。
- `fetchTransactionsInRange` は内部で範囲取得を繰り返し、API の1回上限を超えても全件返す。
- 一覧表示用に `fetchTransactionPage` を追加し、50件と前後ページ情報を返す。
- 定期収支 Cron は `CRON_SECRET` を Bearer 認証し、東京日付をRPCへ渡す。
- service-role クライアントは `server-only` な専用モジュールに閉じ込める。

## 環境変数

- `SUPABASE_SERVICE_ROLE_KEY`: Cron と既存 E2E 管理処理用。クライアントへ公開しない。
- `CRON_SECRET`: Vercel Cron Route Handler の認証用。
- `NEXT_PUBLIC_APP_URL`: `metadataBase` 用の公開URL。

## テスト方針

- クエリのエラー送出、1,000件超の範囲取得、50件ページングをユニットテストする。
- Cron の未認証、正常生成、RPC失敗、東京日付を Route Handler テストで検証する。
- RLS と複合外部キーはマイグレーション内容と、可能な環境では直接API統合テストで検証する。
- 既存 E2E を `--workers=1` で全通過させ、主要フローの互換性を確認する。

## 対象外

- UI/UX の全面再設計、認証基盤の交換、Supabase 以外への移行。
- 精算スナップショットを法的・会計的な確定記録へ変更すること。
