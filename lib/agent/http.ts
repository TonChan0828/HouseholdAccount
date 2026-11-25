import "server-only";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { isIsoCalendarDate } from "@/lib/period";
import type { Database, Json } from "@/types/database";

export const uuid = z.string().uuid();
export const calendarDate = z.string().refine(isIsoCalendarDate, "実在する日付を指定してください");
export const period = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const idempotencyKey = z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/);
export const tokenPattern = /^Bearer (ha_[0-9a-f]{64})$/i;
const maxBodyBytes = 128 * 1024;

const optionalFields = {
  categoryId: uuid.nullable().optional(),
  memo: z.string().max(200).nullable().optional(),
  memberId: uuid.nullable().optional(),
};

export const entry = z.strictObject({
  ...optionalFields,
  date: calendarDate,
  type: z.enum(["income", "expense"]),
  amount: z.number().int().min(1).max(2_147_483_647),
  routing: z.strictObject({
    target: z.enum(["home", "personal"]),
    payment: z.enum(["aeon_pay", "aeon_card", "other"]),
  }).optional(),
});

export const changes = z.strictObject({
  ...optionalFields,
  date: calendarDate.optional(),
  amount: z.number().int().min(-2_147_483_647).max(2_147_483_647)
    .refine((amount) => amount !== 0, "金額は0円以外で入力してください").optional(),
}).refine((value) => Object.keys(value).length > 0, "変更する項目を指定してください");

const messages: Record<string, string> = {
  invalid_token: "API トークンが無効か失効しています。",
  group_not_found: "対象のグループが見つかりません。",
  transaction_not_found: "更新・削除できる収支が見つかりません。",
  invalid_category: "収支の種別・グループに合うカテゴリを指定してください。",
  invalid_member: "対象グループのメンバーを指定してください。",
  invalid_memo: "メモは200文字以内で入力してください。",
  invalid_transaction_amount_or_date: "収支の金額または日付を確認してください。",
  invalid_changes: "変更内容を確認してください。",
  invalid_range_or_page: "期間またはページの指定を確認してください。",
  invalid_batch_size: "登録件数は1件から100件です。",
  idempotency_conflict: "同じ Idempotency-Key で異なる内容が登録済みです。",
  invalid_routing: "振り分けの登録先と支払い方法を確認してください。",
  routing_not_configured_for_group: "このグループの振り分け設定が見つかりません。",
  invalid_category_mapping: "設定した反映先カテゴリが利用できません。",
  destination_category_missing: "対応する反映先カテゴリが見つかりません。",
  aeon_expense_category_missing: "反映先に支出カテゴリ「イオン支払い」が必要です。",
  aeon_income_category_missing: "反映先に収入カテゴリ「その他収入」が必要です。",
};

export function apiError(status: number, code: string, message: string): Response {
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (status === 401) headers.set("WWW-Authenticate", "Bearer");
  return Response.json({ error: { code, message } }, { status, headers });
}

export function invalidInput(error: z.ZodError): Response {
  const first = error.issues[0];
  const field = first?.path.join(".");
  const message = first?.message ?? "パラメータを確認してください。";
  return apiError(422, "invalid_input", field ? `${field}：${message}` : message);
}

export async function readJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw apiError(400, "invalid_json", "JSON を送信してください。");
  let size = 0;
  let text = "";
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBodyBytes) {
        await reader.cancel().catch(() => undefined);
        throw apiError(413, "body_too_large", "送信データは128 KiB以内で指定してください。");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof Response) throw error;
    throw apiError(400, "invalid_json", "有効な JSON を送信してください。");
  } finally {
    reader.releaseLock();
  }
}

type Operation = "groups" | "categories" | "transactions" | "create" | "update" | "delete";

export async function agentRequest(
  request: Request,
  operation: Operation,
  parse: () => Json | Promise<Json> = () => ({}),
): Promise<Response> {
  const authorization = request.headers.get("authorization") ?? "";
  const token = tokenPattern.exec(authorization)?.[1];
  if (!token) return apiError(401, "invalid_token", messages.invalid_token);

  try {
    const args = await parse();
    const client = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await client.rpc("agent_api_v1", {
      _token: token,
      _operation: operation,
      _arguments: args,
    });
    if (error) {
      const expectedStatus = /^PT(401|404|409|422)$/.exec(error.code)?.[1];
      if (expectedStatus && Object.hasOwn(messages, error.message)) {
        return apiError(Number(expectedStatus), error.message, messages[error.message]);
      }
      if (["22003", "22007", "22008", "22P02", "23503", "23514"].includes(error.code)) {
        return apiError(422, "invalid_input", "収支の値または関連するカテゴリ・メンバーを確認してください。");
      }
      return apiError(503, "temporarily_unavailable", "家計簿に接続できません。時間をおいてお試しください。");
    }
    return Response.json(data, {
      status: operation === "create" ? 201 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof z.ZodError) return invalidInput(error);
    return apiError(503, "temporarily_unavailable", "家計簿に接続できません。時間をおいてお試しください。");
  }
}
