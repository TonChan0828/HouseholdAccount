import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc }),
}));

import { GET } from "./route";

describe("GET /api/cron/recurring", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
    rpc.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("Bearer secret が無ければ401を返す", async () => {
    const response = await GET(new Request("http://localhost/api/cron/recurring"));

    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("東京日付で一括生成RPCを呼ぶ", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T15:15:00Z"));
    rpc.mockResolvedValue({ data: 3, error: null });
    const response = await GET(
      new Request("http://localhost/api/cron/recurring", {
        headers: { authorization: "Bearer test-cron-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("generate_all_due_recurring", {
      _as_of_date: "2026-07-16",
    });
    await expect(response.json()).resolves.toEqual({ ok: true, generated: 3 });
  });

  it("RPC失敗時は詳細を公開せず500を返す", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "database detail" } });
    const response = await GET(
      new Request("http://localhost/api/cron/recurring", {
        headers: { authorization: "Bearer test-cron-secret" },
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "定期収支の生成に失敗しました",
    });
  });
});
