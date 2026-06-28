# 2026-06-28 — カレンダービュー（spec 29）

## やったこと

- 機能仕様書 `docs/specs/29_calendar_view.md` を作成、CLAUDE.md の spec 一覧を更新。
- `lib/calendar.ts`（暦月グリッド計算・日次集計の純関数）を TDD で実装（`lib/calendar.test.ts` 10 ケース）。
- `components/features/calendar/calendar-board.tsx`（クライアント。日タップで明細切替）を TDD で実装（5 ケース）。
- `app/(dashboard)/calendar/page.tsx`（サーバー。グリッド範囲取得→集計→当月明細を Board へ）を追加。
- `refFromParam` を `lib/period.ts` に切り出し、収支ページと共有。
- `nav-items.ts` に「カレンダー」を追加、`mobile-tab-bar` の FAB 分割を `Math.ceil` で均等化。`nav-items.test.ts` を更新。
- `e2e/calendar.spec.ts` を追加。検証: 単体 469 件・E2E 43 件すべて green、typecheck・lint クリーン。
- レスポンシブ修正: 375px で日セルの金額がはみ出す問題を `compactAmount`（「万」単位）と幅制約で解消。
- 375px でモバイル下部タブが5個になり中央 FAB が偏って崩れる問題を修正。カレンダーをモバイルタブから外して4件（2:2＋中央FAB）を維持し、収支/カレンダー両ページ上部に「リスト⇄カレンダー」セグメントトグル `ViewToggle` を追加して相互遷移できるようにした。実機幅 375px で目視確認済み。

## 決めたこと・理由

- 期間区切りは暦通りの月（1日〜末日）。週グリッド（日〜土）との相性を優先し、他ページの締め日ベース期間とは独立させる。
- 日セルに収入/支出合計を表示し、タップでカレンダー下にその日の明細をクライアント側で即時表示。
- 月ナビは既存ページ同様 `?ref=YYYY-MM-DD` の URL リンク方式、日選択のみクライアント state。

## 次にやること

- PR 作成・レビュー → main へマージ。

## 未解決の課題

- モバイル下部タブが5個になった。実機幅でのレイアウト確認（FAB 分割は 3/2 に均等化済み）。
- 1日の収支件数が多い場合のセル内表示（現状は合計のみ）。
