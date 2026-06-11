# ダークモード 仕様書

## 概要

アプリ全体にダークテーマを追加し、ユーザーがライト/ダーク/システム（OS 設定追従）の3択でテーマを切り替えられるようにする。導入済みの next-themes と、globals.css の CSS 変数設計（`.dark` で同じ変数セットを上書きする前提の構成）を活用する。

## 対象ユーザー・前提条件

- 全ユーザー（ログイン前の画面を含む）
- テーマ設定は端末ごとに localStorage へ保存する（アカウントには紐付けない）
- デフォルトは「システム」（OS のダークモード設定に追従）

## 画面・UI

### 表示内容

- **認証済み画面（AppHeader あり）**: ヘッダー右上のユーザードロップダウンメニュー内に「テーマ」セクションを追加。ライト/ダーク/システムの3項目を表示し、現在選択中の項目にチェックマークを表示する
- **ヘッダーのない画面（ログイン・登録・グループ選択）**: 画面右上に太陽/月アイコンの独立トグルボタンを配置（クリックでドロップダウン、または現在テーマに応じたアイコン表示）
- **ダークテーマのカラー**: 「温かみのある家計簿」の世界観を維持する
  - 背景は純黒ではなく深いグリーン系のダークトーン
  - カードは背景よりやや明るいサーフェス
  - `--income` / `--expense` / `--chart-*` はダーク背景でのコントラストを確保するため明度を上げる
  - body の装飾グラデーション（光彩）はダーク用に減光した色へ差し替える

### インタラクション・バリデーション

- テーマ切り替えは即時反映（ページリロード不要）
- リロード・再訪問後も選択したテーマが維持される（next-themes の localStorage 永続化）
- 初回描画時のテーマちらつき（FOUC）を防ぐため、next-themes の inline script により hydration 前に `<html>` へ `.dark` class を付与する（`<html>` に `suppressHydrationWarning` を設定）
- 「システム」選択時は OS 設定の変更に動的に追従する

## データモデル

### 入力

```typescript
// next-themes が扱うテーマ値
type Theme = "light" | "dark" | "system";
```

### 出力

```typescript
// useTheme() フック（next-themes）
type UseThemeReturn = {
  theme: Theme | undefined;          // 選択中のテーマ
  resolvedTheme: "light" | "dark" | undefined; // system 解決後の実テーマ
  setTheme: (theme: Theme) => void;
};
```

## Supabase

### 使用テーブル

- なし（テーマ設定はクライアントサイドのみで完結し、DB には保存しない）

### RLS ポリシー

- 変更なし

### クエリ / Server Action

```typescript
// なし
```

## 実装コンポーネント

- `components/theme-provider.tsx` — next-themes の `ThemeProvider` をラップ（`attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`）。`app/layout.tsx` で `<body>` 直下に配置
- `components/features/layout/theme-toggle.tsx` — テーマ切り替え UI
  - `ThemeMenuItems`: ドロップダウンメニュー内に埋め込む3項目（AppHeader 用）
  - `ThemeToggleButton`: 独立アイコンボタン（ログイン前・グループ選択画面用）
- `app/globals.css` — `.dark` セレクタで CSS 変数一式を上書き

## 未解決の課題

- アカウント単位でのテーマ同期（DB 保存）は将来検討
