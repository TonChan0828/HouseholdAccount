/**
 * カテゴリ別登録漏れリマインダーの表示条件判定（純関数）。
 *
 * ダッシュボード訪問時にサーバー側で判定する。プッシュ通知・メール送信の
 * インフラは存在しないため、条件を満たす限り訪問のたびに表示する。
 */

export const NO_TRANSACTIONS_REMINDER_THRESHOLD_DAYS = 3;

export type CategoryReminderTarget = { id: string; name: string };

export type CategoryReminderInput = {
  /** 当期（?ref= なし相当の期間）を表示しているか。 */
  viewingCurrent: boolean;
  /** 当期の残り日数（lib/forecast.ts#buildForecast と同じ意味論）。 */
  daysRemaining: number;
  /** 通知ON（reminder_enabled=true）のカテゴリ一覧。 */
  targets: CategoryReminderTarget[];
  /** 当期のカテゴリ別取引件数。 */
  countByCategoryId: Record<string, number>;
};

/** 通知ONのカテゴリのうち、当期まだ取引が無いものを返す。 */
export function getUnrecordedReminderCategories(
  input: CategoryReminderInput,
): CategoryReminderTarget[] {
  if (!input.viewingCurrent) return [];
  if (input.daysRemaining > NO_TRANSACTIONS_REMINDER_THRESHOLD_DAYS) return [];

  return input.targets.filter(
    (t) => (input.countByCategoryId[t.id] ?? 0) === 0,
  );
}
