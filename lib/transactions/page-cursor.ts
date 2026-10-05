/** 日付・作成日時・IDを保持するページ境界。値はPostgREST条件へ渡す前に検証する。 */
export type PageCursor = {
  direction: "after" | "before";
  date: string;
  created_at: string;
  id: string;
};

export function encodePageCursor(
  row: Omit<PageCursor, "direction">,
  direction: PageCursor["direction"],
): string {
  const boundary = { direction, date: row.date, created_at: row.created_at, id: row.id };
  return Buffer.from(JSON.stringify(boundary)).toString("base64url");
}

export function decodePageCursor(value?: string): PageCursor | null {
  if (!value || value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      (cursor.direction !== "after" && cursor.direction !== "before") ||
      typeof cursor.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(cursor.date) ||
      !Number.isFinite(Date.parse(cursor.date)) ||
      new Date(`${cursor.date}T00:00:00Z`).toISOString().slice(0, 10) !== cursor.date ||
      typeof cursor.created_at !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(cursor.created_at) ||
      !Number.isFinite(Date.parse(cursor.created_at)) ||
      typeof cursor.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cursor.id)
    ) return null;
    return cursor;
  } catch {
    return null;
  }
}

export function cursorCondition(cursor: PageCursor): string {
  const op = cursor.direction === "after" ? "lt" : "gt";
  return `date.${op}.${cursor.date},and(date.eq.${cursor.date},created_at.${op}.${cursor.created_at}),and(date.eq.${cursor.date},created_at.eq.${cursor.created_at},id.${op}.${cursor.id})`;
}
