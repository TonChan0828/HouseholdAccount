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
  - `transactions` は spec 41（0024）で名義人（`on_behalf_of`）にも許可を広げた。
    条件を OR に緩めた副作用で入力者を詐称できるようになるため、BEFORE UPDATE トリガー
    `private.freeze_transaction_identity()` で `created_by` と `household_id` を不変にしている。
- `transactions` / `recurring_transactions` / `budgets` のカテゴリは、行と同じ
  `household_id` のカテゴリだけを参照できる複合外部キーで保証する。
- 既存の異常なカテゴリ参照は、取引・定期収支では NULL、予算では行削除に正規化する。
- 金額、メモ長、貯金目標名・期日についてアプリと同等の DB CHECK を追加する。
- 全グループの定期収支を指定日基準で生成する `generate_all_due_recurring(date)` を追加し、
  `service_role` だけに EXECUTE を許可する。

## アプリケーション境界

- `lib/queries` の予期しない Supabase エラーは `DataAccessError` として送出する。
- `fetchTransactionsInRange` は内部で範囲取得を繰り返し、API の1回上限を超えても全件返す。
- `fetchTransactionPage` は日付・作成日時・IDを境界として50件と前後ページ情報を返す。境界の記録が削除されても、その値から取得を継続する。
- 一覧の集計はRLSを適用する `transaction_daily_summary` に移し、期間全体の明細を転送しない。
- 定期収支 Cron は `CRON_SECRET` を Bearer 認証し、東京日付をRPCへ渡す。
- service-role クライアントは `server-only` な専用モジュールに閉じ込める。

## 環境変数

- `SUPABASE_SERVICE_ROLE_KEY`: アクセス回数制限、Cron と既存 E2E 管理処理用。クライアントへ公開しない。
- `RATE_LIMIT_SECRET`: 32バイト以上のランダム値。本番起動時に回数制限用のSupabase設定と合わせて検査し、不足時は起動を中止する。制限処理自身も本番の設定不足では許可しない。
- `CRON_SECRET`: Vercel Cron Route Handler の認証用。
- `NEXT_PUBLIC_APP_URL`: `metadataBase` 用の公開URL。

## 本番公開とマイグレーション

`Production Release` は `main` の同じコミットで CI、Database、E2E が成功したことを確認します。現在の本番アプリと互換性のあるマイグレーションを適用し、履歴が一致してから Vercel の候補版を本番ドメインへ公開します。Git 連携はプルリクエストのプレビューに使います。

- 初回切り替え前に、GitHub の `Production` 環境にシークレット `SUPABASE_ACCESS_TOKEN`、`SUPABASE_DB_PASSWORD`、`VERCEL_TOKEN` を設定します。変数は `VERCEL_ORG_ID`、`VERCEL_PROJECT_ID`、`VERCEL_SCOPE`、`PRODUCTION_URL` を設定します。
- Supabase のトークンは本番プロジェクトのリンクと履歴照合に必要な権限に絞ります。従来のリポジトリ共通の照合用トークンは、切り替えと定期照合を確認した後に削除します。
- 本番と同じ既存スキーマからの適用、旧アプリの動作、更新後のアプリの動作を事前に隔離環境で確認します。列の削除や名前変更は、新旧アプリで使える追加を先に公開し、旧アプリへの切り戻しが不要になってから別の公開で行います。
- 適用履歴がローカルの履歴の先頭部分と一致する場合に限り、末尾の未適用分を適用します。未知の履歴、途中の欠落、適用後の不一致、候補版の動作確認失敗があれば公開を止めます。
- 適用後に公開が失敗した場合は原因を修正して `main` から再実行します。公開後のアプリに問題があれば、Vercel の直前の本番デプロイを復帰し、DB の変更は別途前方修正します。定期の `Migration Drift` は本番履歴を毎日 09:00 JST に照合します。

## テスト方針

- クエリのエラー送出、1,000件超の範囲取得、50件ページングをユニットテストする。
- Cron の未認証、正常生成、RPC失敗、東京日付を Route Handler テストで検証する。
- RLS と複合外部キーはマイグレーション内容と、可能な環境では直接API統合テストで検証する。
- 既存 E2E を `--workers=1` で全通過させ、主要フローの互換性を確認する。

## 対象外

- UI/UX の全面再設計、認証基盤の交換、Supabase 以外への移行。
- 精算スナップショットを法的・会計的な確定記録へ変更すること。
