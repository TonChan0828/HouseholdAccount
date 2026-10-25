import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  revokeInvitation,
  setFiscalYearStartMonth,
  setPeriodStartDay,
  transferOwnership,
  updateGroupDisplayName,
  updateInvitation,
} from "./actions";

type QueryCall = {
  table: string;
  method: string;
  values?: unknown;
  filters: Record<string, string>;
};

const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  role: null as "owner" | "member" | null,
  calls: [] as QueryCall[],
  rpcCalls: [] as { fn: string; args: unknown }[],
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: async () => "allowed",
  RATE_LIMIT_UNAVAILABLE_MESSAGE: "一時的に利用できません",
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user } }),
    },
    from: (table: string) => {
      const call: QueryCall = { table, method: "", filters: {} };
      state.calls.push(call);
      const resolve = () => {
        if (table === "household_members") {
          return Promise.resolve({
            data: state.role ? { role: state.role } : null,
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      };
      const query = {
        update(values: unknown) {
          call.method = "update";
          call.values = values;
          return query;
        },
        delete() {
          call.method = "delete";
          return query;
        },
        select() {
          return query;
        },
        eq(column: string, value: string) {
          call.filters[column] = value;
          return query;
        },
        maybeSingle: () => resolve(),
        then(
          onFulfilled: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) {
          return resolve().then(onFulfilled, onRejected);
        },
      };
      return query;
    },
    rpc: async (fn: string, args: unknown) => {
      state.rpcCalls.push({ fn, args });
      return { data: null, error: null };
    },
  }),
}));

function formDataWith(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    formData.set(k, v);
  }
  return formData;
}

beforeEach(() => {
  state.user = { id: "user-1" };
  state.role = "owner";
  state.calls = [];
  state.rpcCalls = [];
});

describe("updateInvitation", () => {
  function mutationCalls() {
    return state.calls.filter(
      (c) => c.table === "household_invitations" && c.method === "update",
    );
  }

  it("owner なら招待の人数上限を更新する", async () => {
    await updateInvitation(
      formDataWith({
        invitation_id: "inv-1",
        household_id: "h-1",
        max_uses: "5",
      }),
    );

    expect(mutationCalls()).toEqual([
      {
        table: "household_invitations",
        method: "update",
        values: { max_uses: 5 },
        filters: { id: "inv-1" },
      },
    ]);
  });

  it("owner でなければ更新しない", async () => {
    state.role = "member";

    await updateInvitation(
      formDataWith({
        invitation_id: "inv-1",
        household_id: "h-1",
        max_uses: "5",
      }),
    );

    expect(mutationCalls()).toHaveLength(0);
  });

  it("未ログインなら更新しない", async () => {
    state.user = null;

    await updateInvitation(
      formDataWith({
        invitation_id: "inv-1",
        household_id: "h-1",
        max_uses: "5",
      }),
    );

    expect(mutationCalls()).toHaveLength(0);
  });
});

describe("revokeInvitation", () => {
  function mutationCalls() {
    return state.calls.filter(
      (c) => c.table === "household_invitations" && c.method === "delete",
    );
  }

  it("owner なら招待を失効させる", async () => {
    await revokeInvitation(
      formDataWith({ invitation_id: "inv-1", household_id: "h-1" }),
    );

    expect(mutationCalls()).toEqual([
      { table: "household_invitations", method: "delete", filters: { id: "inv-1" } },
    ]);
  });

  it("owner でなければ失効させない", async () => {
    state.role = "member";

    await revokeInvitation(
      formDataWith({ invitation_id: "inv-1", household_id: "h-1" }),
    );

    expect(mutationCalls()).toHaveLength(0);
  });
});

describe("setPeriodStartDay", () => {
  function mutationCalls() {
    return state.calls.filter(
      (c) => c.table === "households" && c.method === "update",
    );
  }

  it("owner なら period_start_day を更新する", async () => {
    await setPeriodStartDay(
      formDataWith({ household_id: "h-1", period_start_day: "10" }),
    );

    expect(mutationCalls()).toEqual([
      {
        table: "households",
        method: "update",
        values: { period_start_day: 10 },
        filters: { id: "h-1" },
      },
    ]);
  });

  it("owner でなければ更新しない", async () => {
    state.role = "member";

    await setPeriodStartDay(
      formDataWith({ household_id: "h-1", period_start_day: "10" }),
    );

    expect(mutationCalls()).toHaveLength(0);
  });
});

describe("setFiscalYearStartMonth", () => {
  function mutationCalls() {
    return state.calls.filter(
      (c) => c.table === "households" && c.method === "update",
    );
  }

  it("ownerなら世帯の年度開始月を更新する", async () => {
    await setFiscalYearStartMonth(
      formDataWith({ household_id: "h-1", fiscal_year_start_month: "4" }),
    );

    expect(mutationCalls()).toEqual([
      {
        table: "households",
        method: "update",
        values: { fiscal_year_start_month: 4 },
        filters: { id: "h-1" },
      },
    ]);
  });

  it("範囲外の値は更新しない", async () => {
    await setFiscalYearStartMonth(
      formDataWith({ household_id: "h-1", fiscal_year_start_month: "13" }),
    );

    expect(mutationCalls()).toHaveLength(0);
  });

  it("ownerでなければ更新しない", async () => {
    state.role = "member";

    await setFiscalYearStartMonth(
      formDataWith({ household_id: "h-1", fiscal_year_start_month: "4" }),
    );

    expect(mutationCalls()).toHaveLength(0);
  });

  it("未ログインなら更新しない", async () => {
    state.user = null;

    await setFiscalYearStartMonth(
      formDataWith({ household_id: "h-1", fiscal_year_start_month: "4" }),
    );

    expect(mutationCalls()).toHaveLength(0);
  });
});

describe("transferOwnership", () => {
  it("owner なら transfer_ownership RPC を呼ぶ", async () => {
    await transferOwnership(
      formDataWith({ household_id: "h-1", user_id: "u-2" }),
    );

    expect(state.rpcCalls).toEqual([
      {
        fn: "transfer_ownership",
        args: { _household_id: "h-1", _new_owner: "u-2" },
      },
    ]);
  });

  it("owner でなければ RPC を呼ばない", async () => {
    state.role = "member";

    await transferOwnership(
      formDataWith({ household_id: "h-1", user_id: "u-2" }),
    );

    expect(state.rpcCalls).toHaveLength(0);
  });
});

describe("updateGroupDisplayName", () => {
  it("RPC set_member_display_name を正しい引数で呼ぶ", async () => {
    await updateGroupDisplayName(
      formDataWith({ household_id: "h-1", display_name: "パパ" }),
    );

    expect(state.rpcCalls).toEqual([
      {
        fn: "set_member_display_name",
        args: { _household_id: "h-1", _display_name: "パパ" },
      },
    ]);
  });

  it("空文字（ニックネーム解除）も RPC に渡す", async () => {
    await updateGroupDisplayName(
      formDataWith({ household_id: "h-1", display_name: "  " }),
    );

    expect(state.rpcCalls).toEqual([
      {
        fn: "set_member_display_name",
        args: { _household_id: "h-1", _display_name: "" },
      },
    ]);
  });

  it("household_id が無ければ RPC を呼ばない", async () => {
    await updateGroupDisplayName(formDataWith({ display_name: "パパ" }));
    expect(state.rpcCalls).toHaveLength(0);
  });

  it("表示名が長すぎる場合は RPC を呼ばない", async () => {
    await updateGroupDisplayName(
      formDataWith({ household_id: "h-1", display_name: "あ".repeat(21) }),
    );
    expect(state.rpcCalls).toHaveLength(0);
  });
});
