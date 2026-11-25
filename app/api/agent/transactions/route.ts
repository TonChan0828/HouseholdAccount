import { z } from "zod";

import { agentRequest, calendarDate, entry, idempotencyKey, period, readJson, uuid } from "@/lib/agent/http";

const readQuery = z.strictObject({
  group: uuid,
  period: period.optional(),
  start: calendarDate.optional(),
  endExclusive: calendarDate.optional(),
  category: uuid.optional(),
  member: uuid.optional(),
  beforeDate: calendarDate.optional(),
  beforeId: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
}).refine(
  (query) => query.period ? !query.start && !query.endExclusive :
    Boolean(query.start && query.endExclusive && query.start < query.endExclusive),
  "期間の月または開始日と終了日を指定してください",
).refine(
  (query) => Boolean(query.beforeDate) === Boolean(query.beforeId),
  "続きのページの日付とIDを指定してください",
);

const createBody = z.union([
  z.strictObject({ groupId: uuid, entries: z.array(entry).min(1).max(100) }),
  entry.extend({ groupId: uuid }),
]);

export function GET(request: Request) {
  return agentRequest(request, "transactions", () => {
    const { group, category, member, ...query } = readQuery.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return { ...query, groupId: group, categoryId: category, memberId: member };
  });
}

export function POST(request: Request) {
  return agentRequest(request, "create", async () => {
    const key = idempotencyKey.parse(request.headers.get("idempotency-key"));
    const { groupId, ...body } = createBody.parse(await readJson(request));
    return { groupId, key, entries: "entries" in body ? body.entries : [body] };
  });
}
