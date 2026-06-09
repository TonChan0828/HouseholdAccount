# 2026-06-09 — 収支記録 CRUD（02_transactions）

## やったこと

- 仕様書 02_transactions.md 作成、migration 0008（households.period_start_day 1-28/default 1）適用・型反映
- 期間計算 lib/period.ts を TDD（getPeriodRange/shiftPeriod/formatPeriodLabel、月末・うるう年・年跨ぎ網羅、10件）
- バリデーション transaction.ts / periodStartDaySchema を TDD（21件）
- Server Actions: createTransaction / updateTransaction / deleteTransaction / setPeriodStartDay
- UI: /transactions（期間ナビ+集計+一覧）、/transactions/new、/transactions/[id]/edit、TransactionForm、MonthNav、/households に開始日設定、ダッシュボードに導線
- E2E: 収支の追加→一覧表示→編集→削除（7 passed）
- 検証: typecheck / lint / vitest（46 passed）/ playwright（7 passed）すべて green

## 決めたこと・理由

- 収支一覧は**月単位ナビゲーション**。月の区切りは暦月固定ではなく **household ごとに開始日を指定**（締め日モデル）
- 開始日 `period_start_day` は **1〜28 に制限**（31/30 始まりは短い月で消失するため）、デフォルト 1（=暦月）
- 設定変更は **owner のみ**（households の update RLS が owner 限定）
- 期間計算は純粋関数 `lib/period.ts` に切り出し TDD で網羅
- カテゴリ選択はネイティブ `<select>`（base-nova に Select/Dialog が無いため、追加依存なし）
- 登録者表示は本フェーズでは「自分/他メンバー」の区別のみ（auth.users のメールは取得不可、メンバー機能 07 で対応）

## 次にやること

- ダッシュボード（03）: 月次サマリー + 最近の取引（period_start_day を流用）
- メンバー別フィルタ（03/07）
- コミット（feat/test/docs 分割）

## 未解決の課題

- メンバー別フィルタ（ダッシュボード 03 / メンバー 07 と整合）
- 一覧のページネーション（月区切りで件数は限定的なため当面不要）
