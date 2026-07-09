# 2026-07-09 — 月末未記録リマインダー

## やったこと

- docs/specs/38_month_end_reminder.md を作成し CLAUDE.md の仕様書一覧に追記
- lib/reminder.ts（`shouldShowNoTransactionsReminder`）を TDD で実装（lib/reminder.test.ts）
- components/features/dashboard/no-transactions-reminder-card.tsx を TDD で実装（コンポーネントテスト付き）
- app/(dashboard)/dashboard/page.tsx に統合（ForecastCard と同じ `viewingCurrent` ブロック内、`order-2` スロットに積む形で他カードの順序を変更せず追加）
- docs/user-stories.md に本機能のユーザーストーリーとトレーサビリティ行を追加
- e2e/dashboard.spec.ts に新規E2E追加。period_start_day を「今日+k日（k=1..4で1〜28に収まる最小値）」に設定することでサーバー側の実日付から残り日数を閾値内に追い込み、バナー表示→記録後の非表示までを検証
- ポート3000に別プロジェクト（PlanDiff）の node プロセスが居座っておりE2Eが誤接続していたため、ユーザー確認の上でkillしてから実行
- npm run test:run（647件）・typecheck・lint・npm run test:e2e -- --workers=1（58件）すべて通過を確認

## 決めたこと・理由

- ダッシュボードに、当期の残り日数が3日以内かつ登録件数0件のときバナー表示する方針で合意（プッシュ通知・メールのインフラが存在しないため）
- 判定は `viewingCurrent && transactionCount === 0 && daysRemaining <= 3`。`daysRemaining` は既存 `ForecastCard` と同じ `lib/forecast.ts#buildForecast` の値を再利用
- 件数判定はグループ全体の当期取引数（ScopeToggle の「自分のみ」フィルタ前）で行う
- 閉じる（dismiss）機能は不要（登録すれば自然に消えるため）

## 次にやること

- （なし。本機能は完了）

## 未解決の課題

- プッシュ通知・メール通知化する場合はcronなどのバッチ基盤が別途必要（仕様書の未解決課題に記載済み）
