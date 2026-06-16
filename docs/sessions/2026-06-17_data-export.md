# 2026-06-17 — データエクスポート（CSV出力）機能

## やったこと

- 仕様書 `docs/specs/17_data_export.md` を作成。`CLAUDE.md` の一覧に追記
- 実装プラン（plan モード）: `/Users/show/.claude/plans/melodic-marinating-wirth.md`
- 収支データを CSV でダウンロードする機能を TDD で追加
  - `lib/export.ts` `toTransactionsCsv()`: 純関数で CSV 文字列生成（RFC4180 エスケープ + UTF-8 BOM）
  - Route Handler `app/(dashboard)/transactions/export/route.ts`: 認証 → household スコープ →
    現在期間（`ref`）の取引取得 + 登録者名 join → CSV を attachment で返却
  - `app/(dashboard)/transactions/page.tsx` ヘッダーに「CSV出力」リンクを追加
- 検証: typecheck / lint / `test:run` / `test:e2e transactions-export`

## 決めたこと・理由

- **形式は CSV のみ**: 追加ライブラリ不要・表計算で即利用可。ポートフォリオとして十分かつシンプル。
- **対象は画面表示中の期間**: 収支ページのフィルターは期間（`ref`）のみ。export も同じ `ref` を引き継ぐ。
- **Route Handler でサーバー生成**: household スコープの認可を多層防御でサーバー側に閉じ込められる。
  CLAUDE.md の「Server Action 優先」規約の例外だが、ファイルダウンロードは Route Handler が妥当。
- **UTF-8 + BOM**: Excel で日本語が文字化けしないようにするため。

## 次にやること

- main へ統合（PR）

## 未解決の課題

- Excel(.xlsx)・JSON 形式は今回スコープ外
- 期間以外の絞り込み（メンバー別等）は収支ページに無いため未対応
