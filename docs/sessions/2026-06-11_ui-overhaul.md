# 2026-06-11 — フロントエンド全面オーバーホール（Phase 1: 基盤+アプリシェル）

## やったこと

- `docs/specs/08_ui_overhaul.md` を作成し、CLAUDE.md の仕様書一覧に追記
- `globals.css` のテーマを刷新（クリーム背景・グリーン primary・`--income`/`--expense` 変数・radius 1rem・soft/lifted シャドウ・背景光彩）
- フォントを M PLUS Rounded 1c（見出し）+ Noto Sans JP（本文）に変更
- 収入/支出色の直書き（emerald/red）をセマンティッククラスに統一、チャートもテーマ変数参照に
- TDD で共通アプリシェルを実装（`components/features/layout/`: nav-items / AppHeader / MobileTabBar）
  - デスクトップ: スティッキーヘッダー＋アイコン付きナビ＋ユーザーメニュー（グループ切替・カテゴリ・ログアウト）
  - モバイル: 下部タブバー＋中央「記録」FAB
- 各ページのボタン列ナビを削除し、コンテンツ幅を max-w-4xl に拡張
- Vitest 90件・Playwright 11件・typecheck・lint すべてパス。Playwright MCP でデスクトップ/モバイル両幅の表示を確認

## 決めたこと・理由

- テイストは「温かみのある家計簿」（クリーム背景+グリーンアクセント、丸み・柔らかい影）に決定
- 全面オーバーホールを 3 PR に分割（基盤+シェル → ダッシュボード+収支 → 残りページ）
- ダークモードは今回スコープ外（CSS 変数はダーク追加可能な構造を維持、未使用の .dark ブロックは削除）
- shadcn の dropdown-menu は Base UI ベースのため、jsdom 向けに vitest.setup.ts へ ResizeObserver 等の stub を追加
- モバイルタブバーにカテゴリは載せず（4タブ+FAB）、ユーザーメニュー経由でアクセスする

## Phase 2 でやったこと

- `lib/format.ts` を新設（`yen`・`formatDayLabel`・`groupByDate`、TDD）し、各所の重複 `yen` を集約
- SummaryCards を前期比付きの3枚カードに刷新（アイコン・収支のポジ/ネガで色が変化）。ダッシュボードで前期データも取得
- 取引一覧（ダッシュボード・収支）を日付グルーピング+カテゴリ色バッジ（`CategoryBadge`）+ホバー演出+空状態CTAに刷新。冗長な「ダッシュボードへ」リンクを削除
- 収支フォームを刷新: 支出/収入のセグメント切替（色付き）、¥付き大型金額入力、カテゴリの色チップ選択（select 廃止）
- E2E のカテゴリ操作を `selectOption` から radio チップの `check()` に更新
- Vitest 101件・Playwright 11件・typecheck・lint パス、Playwright MCP で表示確認

## Phase 3 でやったこと

- 分析: チャート2枚をデスクトップ2カラムのカードに、soft シャドウ適用
- メンバー: イニシャルアバター（チャートパレット色を順番に割当）+ CategoryBadge + lib/format の yen に統一
- カテゴリ: 大きめ色スウォッチ付きカードグリッド（sm:2カラム）に刷新
- グループ選択: ブランドロゴヘッダー追加、利用中カードを outline-primary + チェック付きバッジで強調
- 認証画面: ロゴ + キャッチコピーのブランドパネルを追加
- 全ページの main に出現アニメーションを付与、残っていた「ダッシュボードへ」リンクを削除
- Vitest 101件・Playwright 11件・typecheck・lint パス、Playwright MCP で全ページ表示確認

## 次にやること

- UIオーバーホールの全PRをマージ済み（#6 → #7 → #9 を rebase マージ。#8 はベースブランチ削除でクローズされたため #9 として再作成）
- 次の候補: Vercel デプロイ、表示名編集 UI、ダークモード

## 未解決の課題

- カテゴリチップは sr-only input だと Playwright の check() がヒットしないため、チップ全面を覆う透明 input にしている
- アプリ名は「家計簿アプリ」のまま（ブランド名を付けるかは未決定）
