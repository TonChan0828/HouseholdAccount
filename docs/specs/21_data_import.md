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
- 過去の Excel 取込と household・対象月・種別・カテゴリ名（trim・case-insensitive）・金額・同一内容内の
  出現番号が一致する行はスキップする。手入力は対象外。同じ取込内に同一内容の複数行があれば全件保持する。
  新規登録数と重複スキップ数を完了後に案内する。

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
  amount: number; // 1 以上の整数（transactions.amount の int32 上限まで）
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
- `transactions.import_key`（Excel 取込行の冪等キー。通常の手入力では NULL）
- `confirm_transaction_import` RPC（不足カテゴリ作成と取引登録を単一DBトランザクションで実行）

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

// 2) 確定→DB RPC でカテゴリ解決（自動作成）と重複を除いた insert を原子的に実行
export async function confirmImport(
  _prev: { error: string } | undefined, formData: FormData,
): Promise<{ error: string } | undefined>;
// 認証→household→rows(JSON) と month を再検証
//   →confirm_transaction_import(household, month, rows)
//     （RLS + 所属確認、家計単位の advisory lock、カテゴリ作成と取引 insert を1 transaction で確定）
//     同一 household・対象月・種別・カテゴリ・金額・同一内容内の出現番号に一致する
//     過去の Excel 取込行は再登録せず、新規登録件数を返す。
//   →revalidate→redirect("/transactions")
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
- Database `supabase/tests/database/atomic_transaction_import.sql`: RPC 権限、household 境界、カテゴリ再利用、
  失敗時にカテゴリと取引の両方が rollback されることを確認。

## 未解決の課題

- **フラットな取引リスト形式の取り込みは対象外**: 本テンプレートのセクション構造前提。別形式は将来対応。
- **列マッピングの手動 UI は対象外**: 固定レイアウト前提。
- CSV インポートは対象外（今回は .xlsx のみ）。
- `docs/inputs/`（個人データ）は `.gitignore` 対象。E2E は合成フィクスチャを使う。
- **カテゴリ自動作成と取引 insert が非アトミック**（cloud review 指摘）: 取引 insert 失敗時に
  カテゴリだけ残る／別メンバー同時取込で同名カテゴリが二重作成され得る問題は、
  `confirm_transaction_import` RPC で解消した。RPC はカテゴリと取引を同一トランザクションで扱い、
  household 単位の transaction advisory lock 下で既存カテゴリを照合してから作成する。
  ただし `/categories` の直接作成や household 初期化はこのロックを使わず、DB 全体の
  `(household_id, lower(name), type)` 一意性は保証しない。全経路に一意制約を導入する場合は、
  既存重複カテゴリとそれを参照する取引・予算等の統合方針を別途決める必要がある。
- **redirect 後のラベル**: 取込後は `?ref=YYYY-MM-01` へ遷移する。`period_start_day != 1` の
  グループでは取込行（月初日付）は表示期間に必ず含まれる（可視）が、期間ラベルは「前月X日〜当月Y日」
  になる。これは custom 期間開始日の仕様どおりで全画面共通の挙動のため許容（cloud review 指摘を検証し、
  提案の `ref=YYYY-MM-startDay` は逆に取込行が期間外になり不可と確認）。

## 対象月とプレビューの操作

シート名、ファイル名の順に対象月を推定します。推定できない場合は入力を求めます。対象月はシートごとに編集値を保持し、確定直前に対象月と件数を表示します。プレビューは1ページ50行です。解析が10秒で終了した場合は理由を示し、続けて別ファイルを選べるようにします。

## 取り込める日付、金額、名義人

任意の「日付」列を使い、日付セルまたは YYYY-MM-DD の値を保持します。空欄は対象月の1日です。数式は保存済みの計算値を使用し、値が未保存またはエラーの場合はセル番地を報告します。エラー行を除外する場合は件数の確認が必要です。

シートごとに現在のグループの名義人を指定できます。負額は元の収支区分を保つ調整行とし、精算対象から外します。確定は1回のデータベース処理で実行し、同一日付・名義人の再試行で重複しないようにします。解析の制限は1ユーザーにつき10分で5回です。上限に達すると解除時刻を表示します。
