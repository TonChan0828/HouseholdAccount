# 2026-09-26 — Excel 取込の重複行スキップ

## 目的

- 同じ Excel 内容を同じ月に再取込したとき、取引が二重に登録されるのを防ぐ。
- 金額・カテゴリ・日付が偶然一致した通常の手入力は重複とみなさない。

## 方針

- transactions に nullable な `import_key` を追加し、Excel RPC から作成した取引だけに値を設定する。
- キーは household・対象月・種別・カテゴリ名（trim・case-insensitive）・金額・同一行の出現番号から作る。
- household とキーの部分 unique index、および既存 household 単位の advisory lock で並行再取込も防ぐ。
- RPC は実際に新規登録した行数を返し、一覧画面で登録数と重複スキップ数を案内する。
- 取込内に同一カテゴリ・金額が複数あれば出現番号で保持する。取込行を削除すればキーも消え、再取込できる。

## 変更

- `supabase/migrations/20260926120000_0027_transaction_import_deduplication.sql`
- Excel 取込 action は RPC の登録件数から重複スキップ数を求める。
- 収支一覧は取込結果の件数を status message として表示する。
- `docs/specs/21_data_import.md` と DB ガイドを実装に合わせて更新。

## 検証

- `npm run test:coverage`: 120 files / 872 tests passed（statement coverage 76.06%）。
- `npm run lint`: 成功。
- `npm run typecheck`: 成功。
- `npm run build`: 成功（Next.js 16.3.5、37 pages）。
- `git diff --check`: 成功。
- Database テストは Docker daemon 未起動のためローカル DB に接続できず未実行。
- E2E は共有 Supabase へテストデータを書き込むため、承認レビューで実行を拒否された。

## 制約

- 同じカテゴリ・月で金額を変更した行は別内容として扱うため、古い値を残したまま新しい値を追加する。
- カテゴリ名の変更後に同じファイルを再取込すると別キーになる。
