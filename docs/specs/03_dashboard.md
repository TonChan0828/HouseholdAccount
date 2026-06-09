# ダッシュボード 仕様書

## 概要

ログイン後の起点画面（`/`）。アクティブな household の「当期間」の収支を一目で把握する。
月次サマリー（収入計・支出計・収支差）と最近の取引を表示し、「全体/自分」で絞り込める。
期間の移動や全件閲覧・追加は収支記録（`/transactions`）に委譲する。

## 対象ユーザー・前提条件

- ログイン済みかつアクティブな household を選択しているメンバー
- アクティブ household 未選択なら `/households` へ誘導
- すべて `household_id` でスコープ（`lib/household.ts#getActiveHouseholdId`）

## 月の区切り（期間）

- 収支記録と同じ締め日モデルを流用する（`households.period_start_day`、`lib/period.ts`）
- ダッシュボードは**当期間固定**（`getPeriodRange(今日, period_start_day)`）。期間ナビは置かない

## 画面・UI

### レイアウト

```text
ダッシュボード        [収支を記録] [グループ選択]
2026/06/01 〜 06/30

[ 全体 | 自分 ]            ← スコープトグル

┌─収入───┐ ┌─支出───┐ ┌─収支───┐
│¥320,000│ │¥185,400│ │+¥134,600│
└────────┘ └────────┘ └────────┘

最近の取引                        すべて見る →
 06/08  ● 食費   ランチ            -¥1,200
 06/07  ● 給与                   +¥320,000
 …（最大5件 / 0件ならプレースホルダ）
```

### 表示内容

- 期間ラベル（`formatPeriodLabel`）
- スコープトグル `全体 | 自分`（`?scope=all|mine`、既定 `all`）。現在のスコープを強調
- サマリーカード: 収入計（緑）・支出計（赤）・収支差
- 最近の取引: 当期間の最新5件（`date desc, created_at desc`）。各行に日付・カテゴリ（色ドット＋名前 / 無ければ「未分類」）・メモ・金額（収入=緑/支出=赤）。「すべて見る」で `/transactions`

### インタラクション・バリデーション

- スコープ `mine` のとき `created_by = auth.uid()` で絞る。サマリー・最近の取引の両方に適用
- トグルはリンク（`/` ?scope=...）。Server Component が `searchParams.scope` を読む
- 入力フォームは無し（閲覧専用画面）

## データモデル

```typescript
// 集計（ページ内で算出）
type Summary = { income: number; expense: number; balance: number };

// lib/period.ts（既存・流用）
getPeriodRange(refDate, startDay) / formatPeriodLabel(range) / toISODate(d)
```

## Supabase

### 使用テーブル

- `households`（`period_start_day` 読み取り）
- `transactions`（当期間で取得）＋ `categories`（join）

### RLS ポリシー（既存）

- `transactions` / `categories` select: `is_household_member(household_id)`

### クエリ（Server Component）

```typescript
// 当期間の収支（scope=mine なら created_by 条件を追加）
let q = supabase
  .from("transactions")
  .select("id, amount, type, date, memo, created_by, category:categories(name, color)")
  .eq("household_id", activeId)
  .gte("date", isoStart)
  .lt("date", isoEnd)
  .order("date", { ascending: false })
  .order("created_at", { ascending: false });
if (scope === "mine") q = q.eq("created_by", user.id);
// サマリーは全件から集計、最近の取引は先頭5件
```

Server Action は不要（閲覧専用）。

## コンポーネント

- `components/features/dashboard/summary-cards.tsx` — 収入/支出/収支の表示（presentational）
- `components/features/dashboard/scope-toggle.tsx` — 全体/自分のリンク（presentational、現在値を強調）
- 最近の取引はページ内でレンダリング（`/transactions` の行表示と整合）
- `/transactions` の既存コードは変更しない（DRY のための無関係改修を避ける）

## テスト

- Component: `SummaryCards`（収入/支出/収支の金額表示）、`ScopeToggle`（全体/自分のリンク・現在値の強調）
- E2E: グループ作成 → 収支追加 → ダッシュボードでサマリーに金額反映 → 全体/自分トグルの遷移

## 未解決の課題

- 個人名別フィルタ（メンバー機能 07 で auth.users 連携後に対応）
- カテゴリ別内訳・推移グラフは分析（05）の領域でダッシュボードには含めない
