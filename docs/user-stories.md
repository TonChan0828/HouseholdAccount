# ユーザーストーリー & E2E トレーサビリティ

各機能仕様（`docs/specs/`）から導いた**ユーザーストーリー**と、それが正常に動作することを
確認する **E2E テスト**（`e2e/`）の対応表。**仕様を変更・追加したら、この表とユーザーストーリー、
対応する E2E を更新し、`npm run test:e2e` の全通過を確認する**（CLAUDE.md Rule 5）。

- **検証方法**の凡例:
  - **E2E** … Playwright で実ブラウザ操作を検証（このファイルの主対象）
  - **Unit/Component** … Vitest で純関数・コンポーネント単体を検証（E2E が困難 or 過剰な領域）
  - **手動** … 外部依存（実メール送受信など）のため自動化対象外。リリース前に手動確認

E2E は CI と同条件（`--workers=1`）で全通過することを基準とする。
（ローカルの多ワーカー並列はグループ作成系が `active_household_id` を共有して競合するため、
全通過の判定は直列実行で行う。`playwright.config.ts` は CI で `workers:1`。）

---

## トレーサビリティ表

| # | 仕様 | ユーザーストーリー（As a … / I want …） | 検証 | E2E スペック |
| --- | --- | --- | --- | --- |
| 00 | overview | メンバーとして、共通アプリシェルから各画面へ移動しホームに戻りたい | E2E | `navigation.spec.ts` |
| 01 | auth | 登録ユーザーとして、メール/パスワードでログインし家計簿に入りたい | E2E | `auth.spec.ts`（ログイン）/ 未認証リダイレクト |
| 01 | auth | ユーザーとして、ログアウトしてセッションを終了したい | Unit | `app/(auth)/actions.test.ts`（※E2Eは共有セッション失効のため不可） |
| 02 | transactions | メンバーとして、収支を追加・編集・削除し、連続登録もしたい | E2E | `transactions.spec.ts` |
| 03 | dashboard | メンバーとして、当期サマリーと最近の取引を見て全体/自分・期間を切り替えたい | E2E | `dashboard.spec.ts` |
| 04 | categories | メンバーとして、カスタムカテゴリを追加・編集・削除し収支フォームに反映したい | E2E | `categories.spec.ts` |
| 05 | analytics | メンバーとして、収支を月次推移とカテゴリ内訳で確認し期間移動したい | E2E | `analytics.spec.ts` |
| 06 | household | ユーザーとして、グループを作成・切り替え・招待リンク発行したい | E2E | `household.spec.ts` |
| 07 | member_activity | メンバーとして、各メンバーの当期集計と取引明細を確認したい | E2E | `members.spec.ts` |
| 08 | ui_overhaul | メンバーとして、刷新されたアプリシェル/ナビで快適に操作したい | E2E | `navigation.spec.ts` / 各 spec |
| 09 | dark_mode | ユーザーとして、ライト/ダーク/システムでテーマを切り替え維持したい | E2E | `theme.spec.ts` |
| 10 | profile_settings | ユーザーとして、自分の表示名を編集しヘッダーに反映したい | E2E | `settings.spec.ts` |
| 11 | security_hardening | ユーザーとして、未認証や非所属では保護データへアクセスできない | E2E + Unit | `auth.spec.ts`（リダイレクト）/ `lib/route-access.test.ts` 他 |
| 12 | landing_page | 訪問者として、公開LPで価値を知り登録へ進みたい | E2E | `auth.spec.ts`（LP表示・CTA）/ `demo.spec.ts` |
| 13 | password_reset | ユーザーとして、パスワード再設定/変更の導線へ進みたい | E2E + 手動 | `auth.spec.ts`（導線）/ 完全フローは手動（実メール） |
| 14 | account_deletion | ユーザーとして、確認フレーズ一致時のみ退会でき誤操作では実行されない | E2E | `account-deletion.spec.ts`（ゲーティング検証・削除は実行しない） |
| 15 | member_management | オーナーとして、委譲・除外・脱退/削除の導線を操作したい | E2E | `household.spec.ts` |
| 16 | household_deletion | オーナーとして、確認モーダルを経てグループを削除したい | E2E | `household.spec.ts` |
| 17 | data_export | メンバーとして、表示中期間の収支をCSVで出力したい | E2E | `transactions-export.spec.ts` |
| 18 | e2e_data_lifecycle | （テスト基盤）一時データを開始時クリーンアップし固定フィクスチャを守る | Unit/基盤 | `e2e/constants.test.ts` / `global-setup.ts` |
| 19 | help | 初見ユーザーとして、各画面の操作手順をアコーディオンで確認したい | E2E | `help.spec.ts` |
| 20 | demo_mode | 訪問者として、登録せずデモで主要機能を試しリロードで初期化したい | E2E | `demo.spec.ts` |
| 21 | data_import | メンバーとして、Excel月次家計簿を取り込み収支へ反映したい | E2E | `transactions-import.spec.ts` |
| 22 | group_display_name | ユーザーとして、グループ毎のニックネームを設定・解除したい | E2E | `group-display-name.spec.ts` |
| 23 | email_verification | 新規ユーザーとして、登録後に確認案内を見て確認メールを再送したい | E2E + 手動 | `auth.spec.ts`（案内ページ・再送ボタン）/ 実メールは手動 |
| 24 | auth_email_templates | ユーザーとして、Shalletブランドの日本語認証メールを受け取りたい | Unit + 手動 | `supabase/templates/templates.test.ts` / 実送信は手動 |
| 25 | amount_expression | メンバーとして、金額欄に式を入力し計算結果で登録したい | E2E | `amount-expression.spec.ts` |
| 26 | recurring_transactions | メンバーとして、定期項目を登録し当期収支を自動生成・停止・削除したい | E2E | `recurring.spec.ts` |
| 27 | receipt_ocr | メンバーとして、レシート画像から金額・日付をプリフィルしたい | E2E(スモーク) + Unit | `receipt-ocr.spec.ts`（導線）/ `lib/receipt/parse-receipt.test.ts`（抽出） |
| 28 | cross_group_reflection | メンバーとして、記帳した収支を他の所属グループへ反映したい | E2E | `cross-group-reflection.spec.ts` |
| 29 | calendar_view | メンバーとして、暦月カレンダーで収支を俯瞰し日付で明細を見たい | E2E | `calendar.spec.ts` |
| 30 | budget_management | メンバーとして、カテゴリ予算を設定し予実・超過・解除を確認したい | E2E | `budgets.spec.ts` |
| 31 | analytics_advice | メンバーとして、当期収支に応じたルールベース助言を分析画面で受けたい | E2E | `analytics-advice.spec.ts` |
| 32 | savings_goal | メンバーとして、貯金目標を設定し進捗・達成・解除を確認したい | E2E | `savings-goal.spec.ts` |
| 33 | month_end_forecast | メンバーとして、当期途中で月末の着地（収支）と予算超過の見込みを知りたい | E2E + Unit | `dashboard.spec.ts`（着地予測カード・予算警告・当期のみ表示）/ `lib/forecast.test.ts`（ハイブリッド算出） |
| 34 | dashboard_two_column_layout | デスクトップ利用者として、ダッシュボードの全カードを少ないスクロールで一覧したい | E2E + Component | `dashboard.spec.ts`・`demo.spec.ts`（内容・セレクタ不変のレイアウト再構成のため全カードの表示・操作は既存 E2E で担保）/ `dashboard-grid.test.tsx`（2カラム構成・モバイル順制御） |

---

## 補足：E2E にしない/できない領域の根拠

- **ログアウト（01）**: 共有 E2E ユーザーのセッションを実際に失効させると、同じ
  `storageState` を使う他の認証テストが連鎖失敗する。ログアウトは Server Action の
  ユニットテストで担保する。
- **実メールを伴うフロー（13 完全再設定 / 23 確認リンク / 24 テンプレート送信）**:
  メール受信は外部依存のため自動化対象外。導線・案内ページまでを E2E で、本文/テンプレートは
  ユニットで検証し、最終確認は手動。
- **レシートOCR（27）**: Tesseract.js（WASM）はブラウザ内で重く非決定的。導線の存在を
  スモークで、抽出ロジックの正常系/異常系をユニットで検証する。
- **退会の実行（14）**: 実削除は共有フィクスチャを壊すため行わず、誤操作防止ゲーティングを
  E2E で検証する。
