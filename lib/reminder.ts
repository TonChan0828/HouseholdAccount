/**
 * 月末未記録リマインダーの表示条件判定（純関数）。
 *
 * ダッシュボード訪問時にサーバー側で判定する。プッシュ通知・メール送信の
 * インフラは存在しないため、条件を満たす限り訪問のたびに表示する。
 */

export const NO_TRANSACTIONS_REMINDER_THRESHOLD_DAYS = 3;

export type ReminderInput = {
  /** 当期（?ref= なし相当の期間）を表示しているか。 */
  viewingCurrent: boolean;
  /** 当期のグループ全体の取引件数。 */
  transactionCount: number;
  /** 当期の残り日数（lib/forecast.ts#buildForecast と同じ意味論）。 */
  daysRemaining: number;
};

export function shouldShowNoTransactionsReminder(
  input: ReminderInput,
): boolean {
  return (
    input.viewingCurrent &&
    input.transactionCount === 0 &&
    input.daysRemaining <= NO_TRANSACTIONS_REMINDER_THRESHOLD_DAYS
  );
}
