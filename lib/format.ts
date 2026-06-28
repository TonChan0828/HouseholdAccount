const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

/** 金額を ¥ 付き桁区切りで整形する。負数はマイナスを ¥ の前に置く。 */
export function yen(n: number): string {
  const abs = Math.abs(n).toLocaleString("ja-JP");
  return n < 0 ? `-¥${abs}` : `¥${abs}`;
}

/**
 * 狭い領域（カレンダーの日セル等）向けに金額を短く整形する。符号・¥ は付けない。
 * 1万未満は桁区切り、1万以上は「万」単位（小数第1位まで）に丸める。
 */
export function compactAmount(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 10000) {
    const rounded = Math.round((abs / 10000) * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}万`;
  }
  return abs.toLocaleString("ja-JP");
}

/** ISO 日付（YYYY-MM-DD）を「M月D日（曜）」に整形する。 */
export function formatDayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日（${WEEKDAYS[d.getUTCDay()]}）`;
}

/** date プロパティごとに、出現順を保ってグループ化する。 */
export function groupByDate<T extends { date: string }>(
  rows: T[],
): { date: string; items: T[] }[] {
  const groups: { date: string; items: T[] }[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.date === row.date) {
      last.items.push(row);
    } else {
      groups.push({ date: row.date, items: [row] });
    }
  }
  return groups;
}
