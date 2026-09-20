# 検索・絞り込み強化 仕様書

## 概要

収支一覧（`/transactions`）に検索・絞り込み機能を追加する。現状は期間ナビ（前月/翌月）しか絞り込み手段がなく、「先月のコンビニ代はいくらか」「あの医療費のメモはどれか」といった日常的な問いに答えられない。カテゴリ・メンバー・種別のフィルタとメモのキーワード検索、金額レンジを追加し、記録した収支を素早く引き出せるようにする。

- フィルタ状態は URL クエリパラメータに持つ（共有・ブックマーク・リロード耐性）
- フィルタは**表示中の期間内**に適用する。期間ナビ（前月/翌月）はフィルタを保持したまま移動できるため、月をまたいだ探索は「フィルタ＋期間移動」で行う
- サマリーカード（収入・支出・収支）と件数はフィルタ適用後の集計を表示する
- DB スキーマ変更なし

## 対象ユーザー・前提条件

- ログイン済みかつ家計簿グループ（household）に所属しているユーザー
- 対象画面は `/transactions`（リスト表示）のみ。カレンダービュー・ダッシュボード・CSV 出力は対象外（現行のまま）

## 画面・UI

### 表示内容

- 期間ナビ（MonthNav）の下にフィルタバーを表示する。構成:
  - **種別**: セグメントピル「すべて / 収入 / 支出」（ScopeToggle と同意匠）
  - **カテゴリ**: セレクト（「すべてのカテゴリ」＋グループのカテゴリ一覧。色ドット付き）
  - **メンバー**: セレクト（「すべてのメンバー」＋グループメンバーの解決済み表示名）。メンバーが1人のグループでは非表示
  - **メモ検索**: テキスト入力（プレースホルダ「メモを検索」、検索アイコン付き）
  - **金額**: 最小・最大の数値入力（「金額(下限)」「金額(上限)」）
- フィルタが1つでも有効なとき:
  - 「クリア」ボタンを表示（全フィルタを解除し期間は維持）
  - 該当0件の場合の空状態は「条件に一致する収支がありません」＋クリアボタン（既存の「この期間の収支はまだありません」と区別する）
- モバイルでは種別ピル＋「絞り込み」開閉ボタンでカテゴリ以下を折りたたむ（デスクトップは常時表示）

### インタラクション・バリデーション

- フィルタ変更は URL クエリを `router.replace`（scroll: false）で更新し、Server Component が再取得・再描画する
- メモ検索・金額入力は 300ms デバウンスして反映する（1文字ごとのリクエストを防ぐ）
- 期間ナビの前月/翌月リンク・CSV 出力リンクは現行どおり `ref` のみを扱い、前月/翌月リンクには有効なフィルタパラメータを引き継ぐ
- クエリパラメータのバリデーション（サーバー側）:
  - `type`: `income` / `expense` 以外は無視
  - `category`: UUID 形式でなければ無視（存在しない ID は結果0件になるだけで害なし）
  - `member`: 同上
  - `q`: 先頭末尾の空白を除去。空なら無視。`%` `_` `\` は LIKE 用にエスケープする
  - `min` / `max`: 0 以上の整数以外は無視。`min > max` の場合は両方適用（結果0件）
- 不正・未知のパラメータでエラーにしない（常に安全側＝無視して全件表示）

## データモデル

### 入力

```typescript
/** URL クエリパラメータ（すべて省略可） */
type TransactionSearchParams = {
  ref?: string;      // 既存: 期間基準日
  type?: string;     // "income" | "expense"
  category?: string; // category_id (UUID)
  member?: string;   // 帰属ユーザー（名義人。spec 41）の user_id (UUID)
  q?: string;        // メモの部分一致キーワード
  min?: string;      // 金額下限（円・整数）
  max?: string;      // 金額上限（円・整数）
};

/** パース済みフィルタ（lib/transaction-filter.ts の純関数で生成） */
type TransactionFilter = {
  type?: "income" | "expense";
  categoryId?: string;
  createdBy?: string;
  memoQuery?: string; // エスケープ前の生キーワード
  minAmount?: number;
  maxAmount?: number;
};
```

### 出力

```typescript
// 既存の TransactionRow[]（lib/queries/transactions.ts）をそのまま使用。
// フィルタ適用後の配列からサマリー（収入・支出合計）と件数を算出する。
```

## Supabase

### 使用テーブル

- `transactions`（読み取りのみ・スキーマ変更なし）
- `categories`（フィルタ選択肢の取得。既存クエリを流用）
- `household_members` / `profiles`（メンバー選択肢。`getHouseholdMemberNames` を流用）

### RLS ポリシー

- 変更なし。既存の「所属 household のデータのみ参照可」ポリシーの範囲内で動作する
- クエリは必ず `household_id` でスコープする（Key Conventions 準拠）

### クエリ / Server Action

```typescript
// lib/queries/transactions.ts — 単一実装点（spec 35）を拡張する
export async function fetchTransactionsInRange(
  supabase: ServerClient,
  householdId: string,
  range: { start: Date; end: Date },
  options?: {
    order?: "asc" | "desc";
    filter?: TransactionFilter; // 追加
  },
): Promise<TransactionRow[]>;

// filter の各項目を指定時のみチェーンする:
//   type      → .eq("type", filter.type)
//   categoryId→ .eq("category_id", filter.categoryId)
//   createdBy → .or("on_behalf_of.eq.X,and(on_behalf_of.is.null,created_by.eq.X)")
//                （帰属ユーザー = coalesce(on_behalf_of, created_by)。spec 41）
//   memoQuery → .ilike("memo", `%${escapeLike(filter.memoQuery)}%`)
//   minAmount → .gte("amount", filter.minAmount)
//   maxAmount → .lte("amount", filter.maxAmount)
```

新規モジュール:

- `lib/transaction-filter.ts` — `parseTransactionFilter(searchParams)`（バリデーション・正規化）、`escapeLike(q)`、`buildFilterQueryString(filter)`（期間ナビリンクへの引き継ぎ用）。すべて純関数として Unit テストを書く
- `components/features/transactions/filter-bar.tsx` — フィルタ UI（Client Component）。カテゴリ・メンバーの選択肢は props でサーバーから渡す

## E2E / テスト方針

- Unit: `parseTransactionFilter`（不正値の無視・エスケープ）、`fetchTransactionsInRange` のフィルタ分岐、FilterBar の操作で URL が更新されること
- E2E（ユーザーストーリー: 「記録した収支を条件で素早く見つけたい」）:
  1. 複数の収支（カテゴリ・種別・メモが異なる）を登録
  2. 種別「支出」で絞り込み → 収入行が消える
  3. カテゴリで絞り込み → 該当カテゴリのみ表示・サマリーが再計算される
  4. メモをキーワード検索 → 一致する行のみ表示
  5. クリア → 全件に戻る

## 未解決の課題

- CSV 出力はフィルタを反映しない（現行どおり期間全件）。反映するかは将来判断
- 期間を無視した全期間横断検索（「過去すべてから探す」）は今回のスコープ外。必要になったら期間プリセット（直近3ヶ月/1年/全期間）として拡張する
- カレンダービューへのフィルタ適用は対象外
