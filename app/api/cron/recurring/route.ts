import { toTokyoISODate } from "@/lib/cron/date";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("generate_all_due_recurring", {
      _as_of_date: toTokyoISODate(),
    });
    if (error) {
      throw new Error("Recurring generation RPC failed", { cause: error });
    }

    return Response.json(
      { ok: true, generated: data ?? 0 },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { ok: false, error: "定期収支の生成に失敗しました" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
