# ヘルプ（操作ガイド）仕様書

## 概要

各画面の操作方法をまとめた**ヘルプページ** (`/help`)。初見のユーザーが収支記録・分析・
メンバー・カテゴリなど各機能の使い方を1ページで把握できるようにする。

- ページごとに折りたたみ可能な**アコーディオン**で操作手順を提示する。
- 文章コンテンツのみ。DB・RLS・マイグレーションは不要（読み取りも行わない静的ページ）。
- 導線はヘッダー右上のユーザードロップダウンメニュー内に「ヘルプ」項目として追加する
  （既存のメインナビ・モバイルタブは変更しない）。

## 対象ユーザー・前提条件

- ログイン済みかつアクティブな household に所属しているユーザー（`(dashboard)` 配下のため）。
- マイグレーション不要・新規テーブルなし。

## 画面・UI

`/help` ページ（`(dashboard)` ルートグループ）。

- レイアウトは `settings/page.tsx` の雛形に準拠（`<main className="mx-auto w-full max-w-2xl space-y-4 p-4 sm:py-8">`）。
- 先頭に `h1`「ヘルプ」＋ 概要文。
- 各セクションをアコーディオン（shadcn/ui Accordion・単一展開）で表示。
  - トリガー: lucide-react アイコン ＋ セクションタイトル（`title`）。
  - 展開時: 概要文（`description`）＋ 操作手順の番号なしリスト（`steps`）。
- メタデータ: `export const metadata = { title: "ヘルプ｜Shallet" }`。

### 導線

`components/features/layout/app-header.tsx` のユーザードロップダウン内、「プロフィール設定」の
下に `CircleHelp` アイコン付きの「ヘルプ」項目（`render={<Link href="/help" />}`）を追加。

## データモデル（コンテンツ定義）

`components/features/help/help-content.ts` に静的配列で定義する。

```ts
export type HelpSection = {
  id: string;          // アコーディオンの value（ユニーク）
  icon: LucideIcon;    // nav-items のアイコンを流用
  title: string;       // 例: "ホーム（ダッシュボード）"
  description: string; // 1行概要
  steps: string[];     // 操作手順
};
export const HELP_SECTIONS: HelpSection[];
```

対象セクション:

| id | タイトル | 概要 |
| --- | --- | --- |
| `home` | ホーム（ダッシュボード） | 月次サマリーと最近の取引の見方 |
| `transactions` | 収支の記録 | 収支の追加・編集・削除、期間切り替え、CSV出力 |
| `recurring` | 定期項目（自動登録） | 固定費・固定収入の定期登録・自動生成・停止/再開 |
| `analytics` | 分析 | 月別推移グラフ（直近6期）・カテゴリ別支出・期間切り替え |
| `members` | メンバー別アクティビティ | メンバーごとの収支の確認 |
| `categories` | カテゴリ管理 | カスタムカテゴリの追加・編集・削除 |
| `household` | グループとメンバー管理 | グループ切り替え・招待・脱退・オーナー委譲・削除 |
| `settings` | 設定（プロフィール・テーマ・退会） | 表示名変更・パスワード変更・テーマ切替・退会 |

## Supabase

- 新規 RLS・テーブルなし。データアクセスを行わない静的ページ。

## テスト

- Unit（`components/features/help/help-content.test.ts`）: 全セクションに id/title/description/steps
  が存在し、`steps` が空でないこと、`id` がユニークであることを検証。
- Component（`components/features/help/help-accordion.test.tsx`）: 全セクションのタイトルが描画され、
  トリガークリックで該当 `steps` が表示されること。

## 未解決の課題

- 各画面内からのコンテキストヘルプ（その場の「？」ボタン）は今回スコープ外。
- 画像・スクリーンショット付きガイドは今回入れない（テキストのみ）。
- カレンダービュー（29）・予算管理（30）のヘルプセクションは未追加。機能追加に追従して節を足す。
