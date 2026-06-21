# アプリ全体ビジュアル統一（やわらかな家計のリビング）設計

- 作成日: 2026-06-21
- 対象: 家計簿アプリ「Shallet」全画面のビジュアルアイデンティティ統一
- 関連: PR #35（収支ビジュアライズ刷新 / `feat/analytics-viz-refresh`）— 本設計が広げる起点。実装はこのPRの成果を取り込む前提。

## 1. 目的

各ページで個別に作り込まれてきた見た目を、**一つの明確なビジュアルアイデンティティ**へ統一する。
統一の実体は「世界観を1か所に閉じ込めた共通プリミティブを全ページが使う」状態にすること。

### アイデンティティ

**「やわらかな家計のリビング」** — 数字に向き合う緊張を、触れたくなる質感とやわらかな光でほどく。

- 主役: **マテリアル（質感）** — 紙/布のような微細な手触り、ふっくらした多層シャドウ、有機的な角丸。
- 補助: **光と動き** — 淡いグラデーションの呼吸、控えめなマイクロアニメ。
- 既存の「温かみのある家計簿」テーマ（クリーム＋深いグリーン）を継承し、正常進化させる。

## 2. 確定要件

| 項目 | 内容 |
| --- | --- |
| タイポ | 見出し **Zen Maru Gothic** / 本文 **Noto Sans** / 数字 **等幅(tabular)** |
| 範囲 | 認証済み全ページ ＋ 共通シェル ＋ 公開側（landing / login / register / パスワード再設定） |
| テーマ | ライト / ダーク 両対応を維持 |
| 制約 | `components/ui/`（shadcn）は直接編集しない／機能・URL・データ挙動は不変（見た目とマークアップのみ）／既存テスト（300件）を維持 |
| 実行戦略 | A：トークン → 共通プリミティブ → 各ページ適用（一貫性最大化） |

## 3. デザイントークン基盤（globals.css）

### カラー（サーフェス3階層を新設）

既存の background / card / primary / income / expense / chart-* を継承しつつ:

- `--surface-sunken`: 背景より一段沈んだクリーム（トラック・溝・インセット用）
- `--surface`: ＝現 `--background`
- `--card`: 持ち上がった面（現状の白を踏襲）
- **温かいサブアクセント1色**（ハニー/アプリコット系）を追加。ハイライト・空状態・小装飾にのみ少量使用。
- ダークは深緑ダークを踏襲し、各サーフェス階層をダーク用に定義。

### 影（フラット→ふっくら）

- 既存 `--shadow-soft` / `--shadow-lifted` を継承。
- `--shadow-pillow`（多層のふっくら凸 / カード・ヒーロー用）を追加。
- `--shadow-inset`（沈んだ凹 / トラック・タイル用）を追加。
- いずれも緑相で淡く色付けし「物質感」を出す。

### 質感

- **極薄グレイン（紙/フェルト風ノイズ）** を全面に1枚だけ重ねる。ライト/ダークで濃度調整。`pointer-events-none` / `aria-hidden`。

### 角丸

- 既存の段階（1rem基準〜4xl）を継承。ヒーロー/装飾の一部に**やや有機的な角丸**を限定使用。

### タイポ・スケール

- `display / h1 / h2 / eyebrow(英字トラッキング) / body / caption / number` の階層と字間を定義し全ページ共通利用。
- `next/font` に **Zen Maru Gothic** を追加し `--font-heading` を差し替え。

### 動き

- 背景グローのゆっくり呼吸（数十秒周期・微小）。
- 既存のスタッガード・リビール（fade + slide-up）を共通化。
- 主要 KPI/サマリーに数字カウントアップ。
- すべて `prefers-reduced-motion: reduce` で停止/無効。

## 4. 共通プリミティブ（`components/shared/`）

shadcn は触らず、世界観を閉じ込めた再利用部品を新設する。各々ユニットテスト付き（TDD）。

| 部品 | 役割 | 主な置換対象 |
| --- | --- | --- |
| `AmbientBackground` | 呼吸グロー＋極薄グレインの土台を全画面に1枚 | globals.css の body 背景を集約 |
| `PageHeader` | `eyebrow ＋ タイトル(Zen Maru Gothic) ＋ 右スロット` で最上部を統一 | dashboard / transactions / analytics のバラバラな最上部 |
| `SectionHeading` | `01 —— 見出し ——` のソフト版（番号は任意） | 各ページの素の `<h2>` |
| `Surface` | shadcn `Card` をラップし `raised`(pillow) / `sunken`(inset) / `flat` ＋有機角丸 | 各所の `Card className="shadow-soft ring-0"` 直書き |
| `Amount` | `value + type(income/expense)` で符号・色・等幅を一元化 | dashboard / transactions の `text-income/expense + yen()` 重複 |
| `StatTile` / `KpiRibbon` | 分析KPIとサマリーで同じ数値表現を共有。`AnimatedNumber`（カウントアップ・reduced-motion対応）内蔵 | analytics の KPI と summary-cards のタイルの別実装 |
| `IconChip` | `size-7 rounded-full bg-*-soft` の反復を部品化 | 各所の丸アイコンチップ |

## 5. 適用計画（波0→3）

### 波0：土台（最初に1回）
- globals.css にトークン追加、Zen Maru Gothic 読込、共通プリミティブ7点を実装（TDD）。
- `(dashboard)/layout.tsx` に `AmbientBackground` をマウント。
- シェル（app-header / mobile-tab-bar / household-switcher / theme-toggle）をマテリアル化。

### 波1：コア体験
- **dashboard**: PageHeader / KpiRibbon・StatTile / SectionHeading / Surface / Amount / IconChip へ置換。
- **transactions（一覧）**: PageHeader、Amount、Surface 行、sticky 日付見出しのソフト化。
- **analytics**: 先行表現を共通プリミティブへ寄せて統一（チャートは維持）。
- 各 `loading.tsx` スケルトンも新トーンに追従。

### 波2：周辺ページ
- transactions/new・[id]/edit（フォーム統一）。
- categories（一覧・new・edit）/ members / settings(プロフィール) / help（アコーディオン）。
- household / households（グループ設定・選択画面）。

### 波3：公開側
- landing（/）ヒーロー刷新（マテリアル＋光）。
- login / register / パスワード再設定（カード・フォーム統一）。

## 6. アクセシビリティ

- すべての動きは `prefers-reduced-motion: reduce` で停止/無効（呼吸・カウントアップ・リビール含む）。
- ライト/ダーク両方で WCAG AA コントラスト確保（特に income/expense と muted テキスト）。
- 装飾要素は `aria-hidden`、アイコンボタンは `aria-label`、フォーカスリング（既存 `outline-ring`）維持。

## 7. テスト方針（TDD）

- 共通プリミティブは Vitest コンポーネントテストを**先に**書く（描画・バリアント・reduced-motion 分岐・`Amount` の符号/色 など）。
- 既存300件を壊さない。文言・`data-testid` を変える場合のみ該当テストを更新。E2E `getByText` 衝突（チャートの注記参照）に注意。
- 波ごとに `typecheck / lint / test:run`、主要ページは Playwright で目視スクショ（ライト/ダーク両方）。
- E2E（`e2e/*.spec.ts`）は原則維持。見た目変更でセレクタが壊れる場合のみ最小修正。

## 8. 完了の定義（DoD）

- 全対象ページが共通プリミティブで構成され、最上部・節見出し・数値・カード面の表現が一致。
- ライト/ダーク両方で破綻なし、reduced-motion で静止。
- typecheck / lint / test:run 全パス、主要画面のスクショ確認済み。

## 9. 作業ルール

- 機能・URL・データ取得・Server Actions は不変、見た目とマークアップのみ。
- 1ページ＝1コミット目安、波ごとに目視検証。
- コミットメッセージは CLAUDE.md 規約（`<type>: <日本語説明>`）に従う。

## 10. 未解決の課題

- サブアクセント（ハニー/アプリコット）の具体色値は波0でライト/ダーク両方を試作して確定。
- グレインの実装方式（インライン SVG ノイズ data-URI か CSS か）は波0で軽量・破綻のない方を選定。
- 本設計の実装ベースを PR #35 マージ後の `main` にするか、PR #35 ブランチ上に積むかは実装着手時に確定。
