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

## 次にやること

- Phase 1 の PR（feature/ui-overhaul-foundation → develop）のレビューとマージ
- Phase 2: ダッシュボード（サマリー3枚カード化・前期比）と収支ページ（日付グルーピング・カテゴリバッジ・フォーム改善）
- Phase 3: 分析/メンバー/カテゴリ/グループ選択/認証画面の仕上げとアニメーション

## 未解決の課題

- 収支ページ下部の「ダッシュボードへ」リンクが冗長になった（Phase 2 で整理）
- /households（グループ選択）と認証画面はシェル対象外のため旧デザインのまま（Phase 3 で対応）
