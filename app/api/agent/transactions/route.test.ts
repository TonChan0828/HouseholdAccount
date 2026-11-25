import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));

import { GET, POST } from "./route";

const url = "http://localhost/api/agent/transactions";
const group = "d812e10a-f228-4a37-b3d3-74ff46cdaa11";
const token = `ha_${"a".repeat(64)}`;

describe("agent transactions", () => {
  beforeEach(() => rpc.mockReset());

  it("returns a machine-readable 401 without a token", async () => {
    const response = await GET(new Request(url));
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe("Bearer");
    expect((await response.json()).error.code).toBe("invalid_token");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("passes validated filters and period to the scoped RPC", async () => {
    rpc.mockResolvedValue({ data: { items: [] }, error: null });
    const response = await GET(new Request(`${url}?group=${group}&period=2026-11&limit=2`, {
      headers: { authorization: `Bearer ${token}` },
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(rpc).toHaveBeenCalledWith("agent_api_v1", {
      _token: token,
      _operation: "transactions",
      _arguments: expect.objectContaining({ groupId: group, period: "2026-11", limit: 2 }),
    });
  });

  it("requires a key and validates the calendar date before writing", async () => {
    const response = await POST(new Request(url, {
      method: "POST",
      body: JSON.stringify({ groupId: group, type: "expense", amount: 100, date: "2026-02-29" }),
      headers: { authorization: `Bearer ${token}`, "idempotency-key": "test-case" },
    }));
    expect(response.status).toBe(422);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns the RPC's conflict code for an idempotency mismatch", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT409", message: "idempotency_conflict" } });
    const response = await POST(new Request(url, {
      method: "POST",
      body: JSON.stringify({ groupId: group, type: "expense", amount: 100, date: "2026-11-25" }),
      headers: { authorization: `Bearer ${token}`, "idempotency-key": "replay-case" },
    }));
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("idempotency_conflict");
  });
});
