# 2026-07-09 — カテゴリ別登録漏れリマインダー

## やったこと

- 前段で実装した「38: 月末未記録リマインダー（グループ全体で0件のとき警告）」を
  ユーザー判断により `git revert`（コミット `2b18053`）で取り消し
- 代わりに「カテゴリ別登録漏れリマインダー」を新機能として設計。仕様書を
  `docs/specs/38_category_reminder.md` として作成（番号は取り消した旧38を再利用）
- `supabase/migrations/0022_category_reminder.sql`（`categories.reminder_enabled` 追加）を
  リモートSupabase（HouseholdAccount-tokyo）に適用。既存21件の移行履歴がローカルの
  番号付きファイル名とリモートのタイムスタンプ記録で一致しない状態だったため
  `supabase db push` は使わず、`supabase db query --linked -f <file>` で直接SQLを実行した
  （ユーザー承認の上で実施。移行履歴の不整合自体は本セッションの対応範囲外として温存）
- `types/database.ts` の `categories` 型に `reminder_enabled` を手動追加（生成コマンド未使用）
- `lib/reminder.ts`（`getUnrecordedReminderCategories`）をTDDで実装
- `/categories` の各カテゴリ行に「通知ON/OFF」トグル（`toggleCategoryReminder` Server Action）を追加。
  デフォルトカテゴリにも付けられる
- `UnrecordedCategoriesReminderCard` を実装しダッシュボードに統合（`ForecastCard` の直上）
- `docs/user-stories.md` に#38として追記、`e2e/categories.spec.ts` にE2E追加
- `npm run test:run`（651件）・typecheck・lint・`npm run test:e2e -- --workers=1`（58件）すべて通過
- ポート3000に別プロジェクト（PlanDiff）のプロセスが2度居座り、都度ユーザー確認の上でkill

## 決めたこと・理由

- ユーザーが `/categories` で「通知ON」にした特定カテゴリ（例: 家賃・給与）について、
  当期の残り日数が3日以内かつそのカテゴリの当期取引が0件のとき、ダッシュボードに
  まとめて1枚のカードで警告する方針
- 判定タイミングは「月末3日前から」（旧38と同じ閾値・同じ visit-triggered 方式を踏襲）
- 設定UIは既存の `/categories` ページに統合（新規専用画面は作らない）。デフォルト
  カテゴリにもトグルを付けられるようにする（名前・色・種別の編集不可とは別軸のため矛盾しない）
- トグルのUIパターンは既存の定期収支「停止/再開」ボタン（hidden input + submit）に揃える
  （このアプリに onChange 自動保存トグルの前例がないため）
- 複数カテゴリが対象になった場合は1枚のカードにまとめて列挙する（カテゴリごとに別カードにはしない）

## 次にやること

- （なし。本機能は完了）

## 未解決の課題

- 通知対象カテゴリ数が多い場合の表示上限は未定義（仕様書に記載済み、実運用を見て検討）
- リモートSupabaseの migration 履歴（`supabase migration list`）がローカルのファイル名と
  一致しない状態が既存（0001〜0021相当）。今回は新規カラム追加を直接SQL実行で回避したが、
  今後 `supabase db push` を使うにはリポジトリと履歴の整合を取る作業が別途必要
- E2Eで「月末残りN日」を作るテクニック（period_start_dayを今日から逆算）は、daysRemaining=0
  ぴったり（k=1）を狙うと収支フォームの日付初期値（ブラウザローカルTZ）と期間計算（サーバUTC）の
  ずれで期間外に落ちることがあると判明。以後はk=4寄り（daysRemaining=3、閾値ぎりぎりだが余裕あり）
  を使うこと
