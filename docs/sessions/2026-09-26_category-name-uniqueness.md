# 2026-09-26 — 同一種別カテゴリ名の重複防止

## 目的

- 同じグループ・同じ種別で、前後空白と大文字小文字だけが異なるカテゴリの重複登録を防ぐ。
- 収入・支出など異なる種別間の同名カテゴリは既存の仕様どおり許可する。
- 既存の重複カテゴリや取引・予算等の参照は自動統合しない。

## 変更

- `categories` の INSERT / 識別キー変更時に走るDB triggerを追加。
- household・正規化名・種別ごとのtransaction advisory lockと既存行照合で、同時登録も直列化する。
- 重複時の SQLSTATE `23505` を追加・編集フォームで利用者向けエラーに変換する。
- カテゴリ名の前後空白は保存前に除去し、空白だけの名前は不許可にする。
- pgTAP、Server Action、E2Eに重複防止の回帰テストを追加。
- `docs/specs/04_categories.md` を更新。

## 検証

- `npm run test:coverage`: 120 files / 874 tests passed（statement coverage 76.24%）。
- `npm run lint`: 成功。
- `npm run typecheck`: 成功。
- ローカルDB / E2E は Docker daemon 未起動のため未実行。PR の Database / E2E workflow で検証する。

## 制約

- 過去に登録済みの同一 household・種別の重複カテゴリは残る。安全な統合には、カテゴリ参照先の付け替え方針が必要。
