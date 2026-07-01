/**
 * 家計簿の「月の区切り」期間計算。
 *
 * 期間は半開区間 `[start, end)`（start <= date < end）。
 * household の `period_start_day`（1〜28）を開始日とし、暦の TZ 揺れを避けるため
 * すべて UTC 真夜中の Date として扱う（DB の `date` 型は時刻を持たない）。
 */

export type PeriodRange = { start: Date; end: Date };

/** Date を `YYYY-MM-DD` 文字列にする（UTC 基準）。 */
export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * 「ユーザーにとっての今日」を `YYYY-MM-DD` にする（ローカル TZ 基準）。
 * UTC 基準の toISODate(new Date()) はローカルの深夜〜早朝に前日へずれるため、
 * ブラウザで「今日」を扱う UI（収支フォームの既定日・カレンダーの今日）はこちらを使う。
 */
export function localToday(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** `?ref=YYYY-MM-DD` を UTC 真夜中の Date に解釈する。不正・未指定は今日。 */
export function refFromParam(ref: string | undefined): Date {
  if (ref && /^\d{4}-\d{2}-\d{2}$/.test(ref)) {
    return new Date(`${ref}T00:00:00Z`);
  }
  return new Date();
}

/** ref を含む期間を返す。startDay は 1〜28 を想定。 */
export function getPeriodRange(ref: Date, startDay: number): PeriodRange {
  const year = ref.getUTCFullYear();
  const month = ref.getUTCMonth(); // 0-11
  const day = ref.getUTCDate();

  // 開始日より前なら、期間は前月の開始日から始まる。
  // 月のアンダーフロー（1月→前年12月）は Date.UTC が正規化するため年は固定でよい。
  const startYear = year;
  let startMonth = month;
  if (day < startDay) {
    startMonth -= 1;
  }

  // Date.UTC は月のオーバーフロー/アンダーフローを正規化する（年跨ぎも処理）。
  const start = new Date(Date.UTC(startYear, startMonth, startDay));
  const end = new Date(Date.UTC(startYear, startMonth + 1, startDay));
  return { start, end };
}

/** range から delta 期間ぶん移動した期間を返す。 */
export function shiftPeriod(
  range: PeriodRange,
  delta: number,
  startDay: number,
): PeriodRange {
  const newStart = new Date(
    Date.UTC(
      range.start.getUTCFullYear(),
      range.start.getUTCMonth() + delta,
      startDay,
    ),
  );
  return getPeriodRange(newStart, startDay);
}

/** 「2026/06/01 〜 2026/06/30」のように開始日〜最終日（排他境界の前日）を表示する。 */
export function formatPeriodLabel(range: PeriodRange): string {
  const lastDay = new Date(range.end.getTime() - 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => toISODate(d).replace(/-/g, "/");
  return `${fmt(range.start)} 〜 ${fmt(lastDay)}`;
}
