# データインポート（Excel月次家計簿の取り込み） 仕様書

## 概要

Excel の月次家計簿（Microsoft「月々の収支（簡易版）」テンプレート）をアップロードし、
費目別の金額を**収支取引としてまとめて取り込む**機能。spec 17（CSVエクスポート）の逆方向にあたり、
「持ち出し（CSV）↔ 取り込み（Excel）」でデータ可搬性を完結させる。

サンプル `docs/inputs/excel/2026年06月家計簿.xlsx` の構造を分析した結果、対象テンプレートは
**1行=1取引のフラットな表ではなく、月次の費目別合計**である点が本機能の核心：

- 先頭シート（例: `月々の収支 (簡易版)`）に「収入」セクションと「支出」セクションがある。
- 各セクションは `項目 | 金額` の2列。項目=カテゴリ名、金額=その月の合計。
- **種別（収入/支出）は項目がどちらのセクションにあるかで決まる**（種別カラムは無い）。
- **日付カラムは無い**（ファイル名「YYYY年MM月家計簿」が月を示す）。
- 金額が空の費目（未使用カテゴリ）が多数存在する。右側のサマリー（割合・収支・引き落とし等）は
  数式列で取り込み対象外。

→ 取り込み = **金額のある費目ごとに1件の取引を、ユーザーが選んだ対象月の1日付で作成**する。

## 対象ユーザー・前提条件

- ログイン済みかつアクティブな household に所属しているユーザー。
- 取り込み先は `getActiveHouseholdId()` で解決した household（多層防御でスコープ）。
- マイグレーション不要（既存 `transactions` / `categories` の読み書きのみ）。
- 対応形式は `.xlsx` のみ。上記テンプレートの**セクション構造**を前提とする（固定レイアウト）。
- **複数シート対応**: 先頭固定ではなく、テンプレ見出し（「1か月の収入/支出」）を含むシートを
  自動検出する。空・非対象シート（例: 空の `Sheet1`）は除外。一致シートが複数（月ごとのシート等）
  あれば画面のセレクタで取り込むシートを選ぶ（1回のアップロードで全一致シートをパースし、選択は
  クライアント状態で切替＝再アップロード不要）。対象月はシート名（例「2026年07月」）→ファイル名の順で推定。

## 画面・UI

### 表示内容

- エントリ: `/transactions` ヘッダーの「CSV出力」隣に「インポート」リンク（`Upload` アイコン,
  `buttonVariants({ variant: "outline", size: "sm" })`）。リンク先 `/transactions/import`。
- `/transactions/import`（2ステップ）:
  1. **アップロード**: ファイル選択（.xlsx）＋ **対象月**入力（`<input type="month">`、
     ファイル名「YYYY年MM月」から初期値を推定）。
  2. **プレビュー**: パース結果を表示。
     - 取込予定（有効）行: 種別・カテゴリ名・金額の一覧 ＋ 合計件数。
     - スキップ行: 金額が空の費目（理由つき、折りたたみ可）。
     - エラー行: 不正な行（行番号・費目・理由）。
     - 「取り込む」確定ボタン（有効行が0件なら無効化）。

### インタラクション・バリデーション

- パース・検証は**サーバー側を正**とする（クライアントを信用しない）。確定時も再検証してから insert。
- **行の取捨**（ユーザー確定済みの方針）:
  - 金額が空 / 0 → **スキップ**（エラー扱いにしない。理由「金額が空」）。
  - 金額があるが数値でない / 整数でない / 1円未満 → **エラー**（その行のみ除外、報告）。
  - 項目名が空なのに金額がある → エラー「項目名がありません」。
  - 項目名が50文字超 → エラー「項目名が長すぎます」（カテゴリ名上限に合わせる）。
  - 上記以外 → 有効行（金額のある費目は貯蓄系=積み立てNISA 等も含め全て取込）。
- 対象月は必須。`YYYY-MM` 形式。取引日付は `YYYY-MM-01` に固定。
- 行数上限（例 500）を超える入力は拒否（過大ファイル対策）。

## データモデル

### 入力

```typescript
// パーサが Excel から抽出する生の行（exceljs 依存部の出力）
export type BudgetRow = {
  section: "income" | "expense"; // どちらのセクションにあったか
  item: string;                  // 項目（カテゴリ名候補）。前後空白は trim
  amount: number | null;         // 金額（数式は result を採用）。空は null
  rowNumber: number;             // 元シートの行番号（エラー報告用）
};

// 確定時にクライアントから送られる有効行（hidden field の JSON）
export type ValidImportRow = {
  type: "income" | "expense";
  categoryName: string;
  amount: number; // 整数 >= 1
};
```

### 出力

```typescript
// 分類結果（プレビュー state）
export type ClassifyResult = {
  valid: ValidImportRow[];
  skipped: { row: number; item: string; reason: string }[];
  errors: { row: number; item: string; reason: string }[];
};

export type ImportPreviewState =
  | { ok: true; month: string; result: ClassifyResult }
  | { ok: false; error: string }
  | undefined;
```

## Supabase

### 使用テーブル

- `categories`（読み: 既存カテゴリの名前一致 / 書き: 不足カテゴリの自動作成）
- `transactions`（書き: 有効行を一括 insert。`household_id` / `created_by` を自動付与）

### RLS ポリシー

- 新規ポリシー・テーブルなし。既存の `household_members` 所属スコープに従う。
- アプリ側でも `household_id` でスコープして多層防御（`user_id` 単体取得は禁止の方針通り）。

### クエリ / Server Action

```typescript
// app/(dashboard)/transactions/import/actions.ts

// 1) アップロード→パース→分類（プレビュー）
export async function parseImportFile(
  _prev: ImportPreviewState, formData: FormData,
): Promise<ImportPreviewState>;
// 認証→household→file.arrayBuffer()→parseWorkbook()→classifyRows()→state を返す

// 2) 確定→カテゴリ解決（自動作成）→一括 insert
export async function confirmImport(
  _prev: { error: string } | undefined, formData: FormData,
): Promise<{ error: string } | undefined>;
// 認証→household→rows(JSON) と month を再検証
//   →resolveCategories: 既存を名前×種別で照合し不足分を bulk insert（color 循環, is_default:false）
//   →transactions を bulk insert（date=`${month}-01`）→revalidate→redirect("/transactions")
```

純関数（`lib/import/excel.ts`、TDD の中心）:

```typescript
export function parseMonthFromFilename(name: string): string | null; // "2026年06月..." → "2026-06"
export async function parseWorkbook(buffer: ArrayBuffer): Promise<BudgetRow[]>; // exceljs でセクション抽出
export function classifyRows(rows: BudgetRow[]): ClassifyResult;     // 取捨・検証（純関数）
export function splitCategoryNames(                                  // 既存/新規をケース非依存で分離
  existing: { name: string; type: string }[],
  needed: { name: string; type: "income" | "expense" }[],
): { matched: Map<string, string>; toCreate: {...}[] };
```

## テスト

- Unit `lib/import/excel.test.ts`:
  - `parseMonthFromFilename`: 「2026年06月家計簿.xlsx」→"2026-06"、不一致→null。
  - `parseWorkbook`: exceljs で合成バッファを生成 → 収入/支出セクションを正しく抽出、数式 result 採用、
    サマリー列の無視、空金額は null。
  - `classifyRows`: 金額空=skip、非数値/小数/0=error、項目空+金額あり=error、50字超=error、
    正常=valid（種別がセクションで決まる）。
  - `splitCategoryNames`: 名前×種別の照合（ケース非依存）、`both` は両種別に一致、不足の抽出。
- Component `import-form.test.tsx`: プレビューの有効/スキップ/エラー表示、有効0件で確定無効、
  対象月の初期値推定。
- E2E `e2e/transactions-import.spec.ts`: グループ作成 → `e2e/fixtures/` の合成 .xlsx をアップロード →
  プレビュー件数を検証 → 対象月選択 → 確定 → `/transactions` に取込行が反映。
  フィクスチャはテスト準備で exceljs により合成生成（実データは使わない）。

## 未解決の課題

- **重複検出は対象外**: 同じ月を2回取り込むと取引が重複する。将来 `(date, category, amount)` での
  重複スキップや「取込済み月」の管理を検討。
- **フラットな取引リスト形式の取り込みは対象外**: 本テンプレートのセクション構造前提。別形式は将来対応。
- **列マッピングの手動 UI は対象外**: 固定レイアウト前提。
- CSV インポートは対象外（今回は .xlsx のみ）。
- `docs/inputs/`（個人データ）は `.gitignore` 対象。E2E は合成フィクスチャを使う。
