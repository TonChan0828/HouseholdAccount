const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

/** 金額を ¥ 付き桁区切りで整形する。負数はマイナスを ¥ の前に置く。 */
export function yen(n: number): string {
  const abs = Math.abs(n).toLocaleString("ja-JP");
  return n < 0 ? `-¥${abs}` : `¥${abs}`;
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
