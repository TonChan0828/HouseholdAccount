# ダッシュボード 仕様書

## 概要

ログイン後の起点画面（`/`）。アクティブな household の「当期間」の収支を一目で把握する。
月次サマリー（収入計・支出計・収支差）、当期収支グラフ、メンバー別カテゴリマトリクス、最近の取引を表示し、
サマリー・当期収支グラフ・最近の取引は「全体/自分」で絞り込める。
期間ナビ（前後の月送り）で過去・未来の期間も閲覧できる。全件閲覧・追加は収支記録（`/transactions`）に委譲する。

## 対象ユーザー・前提条件

- ログイン済みかつアクティブな household を選択しているメンバー
- アクティブ household 未選択なら `/households` へ誘導
- すべて `household_id` でスコープ（`lib/household.ts#getActiveHouseholdId`）

## 月の区切り（期間）

- 収支記録と同じ締め日モデルを流用する（`households.period_start_day`、`lib/period.ts`）
- 表示期間は `?ref=YYYY-MM-DD`（その期間に属する基準日）で決まる。未指定・不正値なら今日にフォールバック（`getPeriodRange(refFromParam(ref), period_start_day)`）
- 期間ナビ（`MonthNav`）の前後矢印で1期ずつ移動する（`shiftPeriod`）。「今月へ戻る」ボタンは置かず、分析・収支一覧・メンバーと同じ前後矢印のみで統一
- 月送りリンクは現在の `scope` を引き継ぐ。逆にスコープトグルは表示中の `ref` を引き継ぎ、月とスコープを相互に保持する
- 「記録する」は表示中の期間を引き継ぐ。当期以外を見ているときは `/transactions/new?date=<期間開始日>` で日付を初期化し、当期表示中は `date` を付けずフォーム既定（今日）に委ねる
- 最近の取引の「すべて見る」も表示中の期間を引き継ぐ。当期以外なら `/transactions?ref=<期間開始日>`、当期表示中は `?ref=` を付けない

## 画面・UI

### レイアウト

```text
ダッシュボード   [‹ 2026/06/01 〜 06/30 ›] [ 全体 | 自分 ] [収支を記録]
                  ↑ 期間ナビ（前後矢印）   ↑ スコープトグル

┌─収入───┐ ┌─支出───┐ ┌─収支───┐
│¥320,000│ │¥185,400│ │+¥134,600│
└────────┘ └────────┘ └────────┘

当期の収支                       ← 棒グラフ（収入=緑 / 支出=赤 の2本）
 ┃
 ┃ █          █
 ┗━━━━━━━━━━━━━━
   収入        支出

メンバー別カテゴリ
【支出】
 カテゴリ   太郎      花子      合計
 ● 食費    ¥40,000  ¥30,000  ¥70,000
 ● 交通費   ¥8,000   ¥5,000  ¥13,000
 合計      ¥48,000  ¥35,000  ¥83,000
【収入】
 カテゴリ   太郎      花子      合計
 ● 給与   ¥300,000 ¥250,000 ¥550,000
 合計     ¥300,000 ¥250,000 ¥550,000

最近の取引                        すべて見る →
 06/08  ● 食費   ランチ            -¥1,200
 06/07  ● 給与                   +¥320,000
 …（最大5件 / 0件ならプレースホルダ）
```

### 表示内容

- 期間ナビ `MonthNav`（前後矢印＋中央に期間ラベル `formatPeriodLabel`）。`?ref=` で期間を移動
- スコープトグル `全体 | 自分`（`?scope=all|mine`、既定 `all`）。現在のスコープを強調し、表示中の `ref` を引き継ぐ
- サマリーカード: 収入計（緑）・支出計（赤）・収支差
- 当期収支グラフ: 当期の収入・支出を2本の棒で並べた棒グラフ（収入=緑 `--income` / 支出=赤 `--expense`）。Y軸は円表記（1万以上は「○万」）、ツールチップは `¥` 表記。**scope トグルに連動**し、サマリーカードと同じ絞り込み後の値を表示する
- メンバー別カテゴリマトリクス: 行=カテゴリ / 列=メンバー＋合計列。【支出】→【収入】の2セクション構成で、各セクションに合計行（メンバーごと）を持つ
  - 当期間に取引のあるカテゴリのみ行として表示（行は合計降順）。`category_id` が null の取引は「未分類」行に集約
  - セクション振り分けは取引の `type` で行う（`both` 型カテゴリは両セクションに現れ得る）
  - 列はメンバーの `joined_at` 順。取引ゼロのメンバーも列に出す（セルは薄色の `-` 表示）
  - **scope トグルの影響を受けず常に全メンバーを表示**（メンバー比較が目的のため）
  - 行が0のセクションは描画しない。両セクションとも空ならマトリクス全体を描画しない
  - モバイルは横スクロール（先頭のカテゴリ列は `sticky` で固定し、スクロール時に数値列の上へ重なるよう `z-10`）
  - メンバー名のヘッダーは内側の `block max-w-[6rem] truncate` 要素で省略表示する（`table-layout: auto` のセル直下では `truncate` が効かず列幅が暴走するため）
  - 横スクロール可能なとき（列が画面に収まらないとき）に、ヒント（`横にスクロールできます →`・モバイルのみ）と右端のフェードを表示する。`scrollWidth`/`clientWidth`/`scrollLeft` を実測し、`ResizeObserver`・`scroll`・`resize` で再判定するクライアントコンポーネント
  - 末尾までスクロールしたらヒントテキストとフェードは不透明度0で消すが、ヒント行の高さは横スクロール可能な間つねに確保する（スクロール中に行が出入りして表が縦にガタつくのを防ぐ）。列が画面に収まっている場合はヒント行ごと非表示
- 最近の取引: 当期間の最新5件（`date desc, created_at desc`）。各行に日付・カテゴリ（色ドット＋名前 / 無ければ「未分類」）・メモ・金額（収入=緑/支出=赤）。「すべて見る」で `/transactions`

### インタラクション・バリデーション

- スコープ `mine` のとき `created_by = auth.uid()` で絞る。サマリー・当期収支グラフ・最近の取引に適用（マトリクスには適用しない）。当期収支グラフはサマリーと同じ `income`/`expense` を共有する。絞り込みは DB クエリではなく JS 側で行う（マトリクスが全メンバー分を必要とするため、取引は無条件で1回取得して使い分ける）
- トグル・期間ナビはリンク（`?scope=...&ref=...`）。Server Component が `searchParams.scope` と `searchParams.ref` を読む
- 入力フォームは無し（閲覧専用画面）

## データモデル

```typescript
// 集計（ページ内で算出）
type Summary = { income: number; expense: number; balance: number };

// lib/category-matrix.ts（新規・純関数）
type MatrixTx = {
  amount: number;
  type: "income" | "expense";
  created_by: string;
  category_id: string | null;
  category: { name: string; color: string | null } | null;
};
type MatrixRow = {
  categoryId: string | null; // null = 未分類
  name: string;
  color: string;
  cells: number[]; // members と同順・同長。取引なしは 0
  total: number;   // 合計列
};
type MatrixSection = {
  rows: MatrixRow[];      // 合計降順
  memberTotals: number[]; // 合計行
  total: number;
};
type CategoryMemberMatrix = {
  members: { userId: string; displayName: string }[];
  expense: MatrixSection;
  income: MatrixSection;
};
buildCategoryMemberMatrix(txs: MatrixTx[], members: MemberInfo[]): CategoryMemberMatrix

// lib/analytics.ts（当期収支グラフ用・純関数）
type BalanceBar = { label: string; amount: number; key: "income" | "expense" };
buildBalanceBars(income: number, expense: number): BalanceBar[]
// => [{ label: "収入", amount: income, key: "income" }, { label: "支出", amount: expense, key: "expense" }]

// lib/period.ts（既存・流用）
getPeriodRange(refDate, startDay) / shiftPeriod(range, delta, startDay) / formatPeriodLabel(range) / toISODate(d)
```

## Supabase

### 使用テーブル

- `households`（`period_start_day` 読み取り）
- `transactions`（当期間で取得）＋ `categories`（join）
- `household_members`（メンバー一覧、`joined_at` 順）＋ `profiles`（display_name 解決）

### RLS ポリシー（既存）

- `transactions` / `categories` select: `is_household_member(household_id)`

### クエリ（Server Component）

```typescript
// 当期間の収支（scope によらず household_id スコープのみで取得）
const q = supabase
  .from("transactions")
  .select("id, amount, type, date, memo, created_by, category_id, category:categories(name, color)")
  .eq("household_id", activeId)
  .gte("date", isoStart)
  .lt("date", isoEnd)
  .order("date", { ascending: false })
  .order("created_at", { ascending: false });
// scope=mine の絞り込みは JS 側: rows.filter(t => t.created_by === user.id)
// サマリー・最近の取引 → 絞り込み後 / マトリクス → 全件 + メンバー一覧から構築
```

Server Action は不要（閲覧専用）。

## コンポーネント

- `components/features/dashboard/summary-cards.tsx` — 収入/支出/収支の表示（presentational）
- `components/features/dashboard/scope-toggle.tsx` — 全体/自分のリンク（presentational、現在値を強調。`currentRef` で表示中の期間を引き継ぐ）
- `components/features/transactions/month-nav.tsx` — 期間の前後送りピル（presentational、`prevHref`/`nextHref` を受ける。分析・収支一覧と共用）
- `components/features/dashboard/category-member-matrix.tsx` — メンバー別カテゴリマトリクス（presentational、`lib/category-matrix.ts` の集計結果を表示）
- `components/features/charts/balance-bar-chart.tsx` — 当期収支の棒グラフ（presentational・client、`income`/`expense` を props で受け取り `buildBalanceBars` で整形。Recharts）
- 最近の取引はページ内でレンダリング（`/transactions` の行表示と整合）
- `/transactions` の既存コードは変更しない（DRY のための無関係改修を避ける）

## テスト

- Unit: `lib/category-matrix.ts#buildCategoryMemberMatrix`（セクション振り分け・合計行/列・列順維持・未分類集約・脱退者除外・0件時）
- Unit: `lib/analytics.ts#buildBalanceBars`（収入→支出の順・ラベル・key・金額、0円時も2本返す）
- Component: `SummaryCards`（収入/支出/収支の金額表示）、`ScopeToggle`（全体/自分のリンク・現在値の強調・`currentRef` 指定時に ref を引き継ぐ）、`CategoryMemberMatrix`（セクション見出し・カテゴリ行・合計・ゼロセル `-`・空時非描画）
- E2E: グループ作成 → 収支追加 → ダッシュボードでサマリーに金額反映 → 全体/自分トグルの遷移 → マトリクスにカテゴリ行と金額が表示・scope=mine でも全メンバー表示のまま
- E2E: 期間ナビで前後の月へ移動（`?ref=` 付与・取引なし期間はプレースホルダ）→ 月を保ったままスコープ切替（ref とscope の相互保持）

## 未解決の課題

- 脱退メンバーの取引はマトリクスから除外されるため、scope=all のサマリー合計とマトリクス総計が乖離し得る（将来「その他」列で吸収する選択肢あり）
- 当期収支グラフは「当期の収入・支出の2本」のみ。カテゴリ別内訳・複数期の推移グラフは分析（05）の領域でダッシュボードには含めない
- 収入・支出ともに0の期間は空に近い軸のみ表示される（専用の「データなし」表示は設けていない）
