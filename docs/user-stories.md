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
| 06 | household | ユーザーとして、グループを作成・切り替え・招待リンク発行したい／招待されたユーザーとして、リンクから参加したい | E2E | `household.spec.ts`（作成・切替・発行に加え、第2ユーザーが招待リンクから参加→脱退） |
| 07 | member_activity | メンバーとして、各メンバーの当期集計と取引明細を確認したい | E2E | `members.spec.ts` |
| 08 | ui_overhaul | メンバーとして、刷新されたアプリシェル/ナビで快適に操作したい | E2E | `navigation.spec.ts` / 各 spec |
| 09 | dark_mode | ユーザーとして、ライト/ダーク/システムでテーマを切り替え維持したい | E2E | `theme.spec.ts` |
| 10 | profile_settings | ユーザーとして、自分の表示名を編集しヘッダーに反映したい | E2E | `settings.spec.ts` |
| 11 | security_hardening | ユーザーとして、未認証や非所属では保護データへアクセスできない | E2E + Unit | `auth.spec.ts`（リダイレクト）/ `lib/route-access.test.ts` 他 |
| 12 | landing_page | 訪問者として、公開LPで価値を知り登録へ進みたい | E2E | `auth.spec.ts`（LP表示・CTA）/ `demo.spec.ts` |
| 13 | password_reset | ユーザーとして、パスワード再設定/変更の導線へ進みたい | E2E + Unit + 手動 | `auth.spec.ts`（導線）/ `components/features/profile/password-form.test.tsx`（ログイン中のパスワード変更フォーム）/ 再設定の完全フローは手動（実メール） |
| 14 | account_deletion | ユーザーとして、確認フレーズ一致時のみ退会でき誤操作では実行されない | E2E | `account-deletion.spec.ts`（ゲーティング検証・削除は実行しない） |
| 15 | member_management | オーナーとして、委譲・除外・脱退/削除の導線を操作したい | E2E | `household.spec.ts`（委譲・除外はボタン表示まで／メンバー自身の脱退は使い捨てグループで実行まで検証） |
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
| 32 | savings_goal | メンバーとして、貯金目標を設定し進捗・達成・解除を確認したい | E2E + Unit | `savings-goal.spec.ts`（期日なしの設定→進捗→達成→解除）/ 期日ありのペース表示・期日バリデーションは `lib/savings-goal.test.ts`・`lib/validations/savings-goal.test.ts` |
| 33 | month_end_forecast | メンバーとして、当期途中で月末の着地（収支）と予算超過の見込みを知りたい | E2E + Unit | `dashboard.spec.ts`（着地予測カード・予算警告・当期のみ表示）/ `lib/forecast.test.ts`（ハイブリッド算出） |
| 34 | dashboard_two_column_layout | デスクトップ利用者として、ダッシュボード/カレンダーを少ないスクロールで一覧したい | E2E + Component | `dashboard.spec.ts`・`demo.spec.ts`・`calendar.spec.ts`（内容・セレクタ不変のレイアウト再構成のため表示・操作は既存 E2E で担保）/ `main-side-grid.test.tsx`・`calendar-board.test.tsx`（2カラム構成・モバイル順制御） |
| 35 | architecture_refactor | メンバーとして、どの集計画面でも共通の認証・期間・メンバー名解決で一貫した結果を見たい | Unit + 既存E2E | 集約ヘルパーは `lib/household.test.ts`・`lib/queries/*.test.ts`。当時の閲覧時生成モデルは spec 39 の Cron 生成へ置換済み。挙動不変の確認は既存 E2E で担保 |
| 36 | transaction_search_filter | メンバーとして、収支一覧を種別・カテゴリ・メンバー・メモ・金額で絞り込み、記録した収支を素早く見つけたい | E2E + Unit | `transactions-filter.spec.ts`（種別/カテゴリ/メモ/金額の絞り込み・クリア・0件時の空状態）/ パラメータ検証・LIKEエスケープは `lib/transaction-filter.test.ts`、クエリ組み立ては `lib/queries/transactions.test.ts`、URL更新・デバウンスは `filter-bar.test.tsx`。メンバーフィルタはセレクトのURL更新を Component で検証（複数ユーザーの実書き込みを要するため E2E は過剰と判断） |
| 37 | member_settlement | メンバーとして、立て替えた支出に精算対象の印を付け、当期の均等割りで誰が誰にいくら払うかを知り、確認したら精算済みとして記録（誤操作は取り消し）したい | E2E + Unit | `settlements.spec.ts`（フォームのチェック→一覧バッジ→2人参加→送金案表示→確定→差異警告→取り消しの一気通貫）/ 均等割り・端数（最大剰余法）・送金案圧縮・脱退者除外は `lib/settlement.test.ts`、確定・二重精算・取り消しの Server Action は `settlements/actions.test.ts`、表示分岐・確認ダイアログは `settlement-view.test.tsx`・`settle-controls.test.tsx` |
| 38 | category_reminder | メンバーとして、家賃や給与など毎月必ず記録したいカテゴリを指定しておき、月末が近いのにそのカテゴリの登録が無ければ一目で気づきたい（通知トグルの意味も設定画面で分かるようにしたい） | E2E + Unit | `categories.spec.ts`（`/categories` で説明ノートの表示→通知ON→ダッシュボードで開始日を逆算し残り3日以内に追い込み、未登録カテゴリの警告カード表示（残りn日付き）→登録後に非表示を検証）/ 表示条件の判定は `lib/reminder.test.ts`、文言・残り日数バッジ・amber強調・CTAリンクは `unrecorded-categories-reminder-card.test.tsx`、トグルの Server Action は `categories/actions.test.ts` |
| 39 | architecture_hardening | メンバーとして、大量データや一時的な障害があっても欠落や誤った空表示なく家計データを扱い、所属外データを変更できない状態で利用したい | E2E + Unit + DB | 既存全 E2E（操作互換）/ `lib/queries/*.test.ts`（取得上限・障害）/ Cron Route Handler テスト / DB 制約・RLS 統合確認 |
| 40 | transaction_modal_editing | メンバーとして、収支一覧・カレンダー・ダッシュボードのどこからでもページを離れずにモーダルで収支を編集・追加し（連続入力・他グループへの反映もそのまま使えて）、待たされずに記帳を続けたい | E2E + Component + Unit | `transactions.spec.ts`（一覧のペンでモーダル編集→URL不変→保存で金額更新／「収支を追加」モーダルでの登録）・`calendar.spec.ts`（明細タップでモーダル編集）・`dashboard.spec.ts`（最近の取引からモーダル編集）・`cross-group-reflection.spec.ts`（追加モーダルからの同時反映・編集モーダルからの後追い反映）/ 開閉・プリフィル・成功時クローズ・失敗時の入力保持・追加時のみ「登録して続ける」「他のグループにも反映する」を出す分岐は `transaction-dialog.test.tsx`、`_dialog` 送信と保存失敗時の入力保持は `transaction-form.test.tsx`、自分の明細のみ編集可は `calendar-board.test.tsx`、Server Action の非リダイレクト応答と revalidate 範囲は `transactions/actions.test.ts`、カテゴリ取得の集約は `lib/queries/categories.test.ts` |
| 41 | transaction_on_behalf_of | メンバーとして、配偶者の支出を自分が代わりに記帳しても、その収支が配偶者の記録として集計され（メンバー別・精算・絞り込み・CSV）、配偶者自身もあとから直したり消したりできるようにしたい | E2E + Component + Unit | `transactions-proxy.spec.ts`（招待で2人目を参加→オーナーが名義人=テストメンバーで登録→一覧の代理バッジ→`/members` が名義人側に集計→`/settlements` の送金案がオーナー→テストメンバー→メンバー絞り込みで代理行がヒット→名義人側でモーダル編集・削除まで／メンバー1人のグループでは名義人欄を出さない）/ 帰属・代理判定・編集可否・or 句生成は `lib/transactions/attribution.test.ts`、名義人基準の集計は `lib/members.test.ts`・`lib/settlement.test.ts`・`lib/category-matrix.test.ts`、名義人の所属検証と入力者基準の正規化は `transactions/actions.test.ts`、セレクトの表示条件・既定値・連続入力での維持は `transaction-form.test.tsx`・`transaction-dialog.test.tsx`、カレンダーの代理バッジと編集可否は `calendar-board.test.tsx` |

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
- **メンバー除外・オーナー委譲の実行（15）**: seed 済みの共有グループ
  （MULTI_MEMBER_HOUSEHOLD）のメンバー構成を壊すため実行せず、ボタン表示までを E2E で
  検証する（実行時の挙動は `member-list.test.tsx` のコンポーネントテストで担保）。
  メンバー自身の脱退は使い捨てグループを使い、招待参加→脱退として実行まで E2E 検証する。
- **ログイン中のパスワード変更（13）**: 共有 E2E ユーザーの資格情報を変更すると失敗時に
  後続テストが全滅するため E2E では実行せず、フォームの挙動は `password-form.test.tsx` の
  ユニットで担保する。
