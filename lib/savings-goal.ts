/**
 * 貯金目標の進捗算出（純関数）。
 *
 * 進捗（貯金額 saved）= 開始日以降・今日までの世帯全体の (収入 − 支出)。
 * saved は呼び出し側で集計済みの値を受け取る。目標額・期日と突き合わせ、
 * 進捗率・残額・達成判定と、期日があるときのペース（残り月数・月あたり必要額）を求める。
 */

/** 目標の入力（DB 行をアプリ向けに写したもの）。 */
export type SavingsGoalInput = {
  name: string;
  targetAmount: number;
  /** YYYY-MM-DD。この日以降の収支差額を貯金とみなす。 */
  startDate: string;
  /** YYYY-MM-DD。任意の期日。null ならペース表示なし。 */
  targetDate: string | null;
};

/** 期日ありのときのペース情報。 */
export type SavingsPace = {
  /** 残り月数。max(1, ceil(残日数/30))。 */
  monthsLeft: number;
  /** 目標達成に必要な月あたり額。ceil(remaining/monthsLeft)。 */
  requiredPerMonth: number;
  /** 残日数 <= 0（期日超過）。 */
  overdue: boolean;
};

/** 進捗の算出結果。 */
export type SavingsProgress = {
  name: string;
  targetAmount: number;
  /** 開始日以降の (収入−支出)。負になりうる。 */
  saved: number;
  /** round(max(saved,0)/target*100)。上限なし（表示側で頭打ち）。 */
  pct: number;
  /** max(target − max(saved, 0), 0)。負の saved は 0 として扱い、残額は目標全額になる。 */
  remaining: number;
  /** saved >= target。 */
  reached: boolean;
  /** targetDate が非 null かつ未達のときのみ。それ以外は null。 */
  pace: SavingsPace | null;
};

const MS_PER_DAY = 86_400_000;

/** YYYY-MM-DD を UTC 0 時のミリ秒に変換する。 */
function dateMs(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getTime();
}

/** Date を UTC の年月日 0 時のミリ秒に正規化する。 */
function utcDayMs(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function buildSavingsProgress(
  goal: SavingsGoalInput,
  saved: number,
  today: Date,
): SavingsProgress {
  const target = goal.targetAmount;
  const reached = saved >= target;
  const positive = Math.max(saved, 0);
  const pct = target > 0 ? Math.round((positive / target) * 100) : 0;
  // 負の貯金（支出超過）は 0 として扱い、残額は目標全額とする（spec 準拠）。
  const remaining = Math.max(target - positive, 0);

  let pace: SavingsPace | null = null;
  if (goal.targetDate && !reached) {
    const days = Math.ceil((dateMs(goal.targetDate) - utcDayMs(today)) / MS_PER_DAY);
    const monthsLeft = Math.max(1, Math.ceil(days / 30));
    pace = {
      monthsLeft,
      requiredPerMonth: Math.ceil(remaining / monthsLeft),
      overdue: days <= 0,
    };
  }

  return { name: goal.name, targetAmount: target, saved, pct, remaining, reached, pace };
}
