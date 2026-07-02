import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTransaction, deleteTransaction, updateTransaction } from "./actions";

type QueryCall = {
  table: string;
  method: string;
  values?: unknown;
  filters: Record<string, string>;
};

const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  householdId: null as string | null,
  matchedRows: [] as { id: string }[],
  calls: [] as {
    table: string;
    method: string;
    values?: unknown;
    filters: Record<string, string>;
  }[],
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  // 実際の redirect と同様に例外を投げて処理を中断させる
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/household", () => ({
  getUserHouseholds: async () => [],
  requireDashboardContext: async () => {
    if (!state.user) {
      throw new Error("NEXT_REDIRECT:/login");
    }
    if (!state.householdId) {
      throw new Error("NEXT_REDIRECT:/households");
    }
    const { createClient } = await import("@/lib/supabase/server");
    return {
      user: state.user,
      householdId: state.householdId,
      supabase: await createClient(),
    };
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user } }),
    },
    from: (table: string) => {
      const call: QueryCall = { table, method: "", filters: {} };
      state.calls.push(call);
      const resolve = () =>
        Promise.resolve({ data: state.matchedRows, error: null });
      const query = {
        insert(values: unknown) {
          call.method = "insert";
          call.values = values;
          return resolve();
        },
        update(values: unknown) {
          call.method = "update";
          call.values = values;
          return query;
        },
        delete() {
          call.method = "delete";
          return query;
        },
        eq(column: string, value: string) {
          call.filters[column] = value;
          return query;
        },
        select() {
          return resolve();
        },
        then(
          onFulfilled: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) {
          return resolve().then(onFulfilled, onRejected);
        },
      };
      return query;
    },
  }),
}));

function createFormData(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("type", "expense");
  formData.set("amount", "1500");
  formData.set("date", "2026-06-13");
  formData.set("category_id", "");
  formData.set("memo", "ランチ");
  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }
  return formData;
}

function updateFormData() {
  const formData = new FormData();
  formData.set("id", "t-1");
  formData.set("type", "expense");
  formData.set("amount", "1500");
  formData.set("date", "2026-06-13");
  formData.set("category_id", "");
  formData.set("memo", "ランチ");
  return formData;
}

beforeEach(() => {
  state.user = { id: "user-1" };
  state.householdId = "h-1";
  state.matchedRows = [{ id: "t-1" }];
  state.calls = [];
});

describe("createTransaction", () => {
  it("household_id と created_by を付与して登録する", async () => {
    await expect(
      createTransaction(undefined, createFormData()),
    ).rejects.toThrow("NEXT_REDIRECT:/transactions");

    const insert = state.calls.find((c) => c.method === "insert");
    expect(insert?.table).toBe("transactions");
    expect(insert?.values).toMatchObject({
      household_id: "h-1",
      created_by: "user-1",
      amount: 1500,
    });
  });

  it("金額の四則演算式を評価して登録する", async () => {
    await expect(
      createTransaction(undefined, createFormData({ amount: "1280+980+550" })),
    ).rejects.toThrow("NEXT_REDIRECT:/transactions");

    const insert = state.calls.find((c) => c.method === "insert");
    expect(insert?.values).toMatchObject({ amount: 2810 });
  });

  it("_continue=1 の場合は redirect せず成功状態を返す", async () => {
    const result = await createTransaction(
      undefined,
      createFormData({ _continue: "1" }),
    );

    expect(result).toEqual({ ok: true, key: expect.any(String) });
    expect(state.calls.find((c) => c.method === "insert")).toBeDefined();
  });

  it("_continue が無い場合は /transactions にリダイレクトする", async () => {
    await expect(
      createTransaction(undefined, createFormData()),
    ).rejects.toThrow("NEXT_REDIRECT:/transactions");
  });
});

describe("updateTransaction", () => {
  it("未ログインの場合は /login にリダイレクトし更新しない", async () => {
    state.user = null;

    await expect(updateTransaction(undefined, updateFormData())).rejects.toThrow(
      "NEXT_REDIRECT:/login",
    );
    expect(state.calls).toHaveLength(0);
  });

  it("アクティブグループ未選択の場合は /households にリダイレクトする", async () => {
    state.householdId = null;

    await expect(updateTransaction(undefined, updateFormData())).rejects.toThrow(
      "NEXT_REDIRECT:/households",
    );
    expect(state.calls).toHaveLength(0);
  });

  it("id と household_id の両方でスコープして更新する", async () => {
    await expect(updateTransaction(undefined, updateFormData())).rejects.toThrow(
      "NEXT_REDIRECT:/transactions",
    );

    const update = state.calls.find((c) => c.method === "update");
    expect(update?.table).toBe("transactions");
    expect(update?.filters).toEqual({ id: "t-1", household_id: "h-1" });
  });

  it("対象が見つからない場合（他グループ・他人の取引）はエラーを返す", async () => {
    state.matchedRows = [];

    const result = await updateTransaction(undefined, updateFormData());

    expect(result).toEqual({ error: "対象の収支が見つかりません" });
  });
});

describe("deleteTransaction", () => {
  it("未ログインの場合は /login にリダイレクトし削除しない", async () => {
    state.user = null;
    const formData = new FormData();
    formData.set("id", "t-1");

    await expect(deleteTransaction(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/login",
    );
    expect(state.calls).toHaveLength(0);
  });

  it("id と household_id の両方でスコープして削除する", async () => {
    const formData = new FormData();
    formData.set("id", "t-1");

    await expect(deleteTransaction(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/transactions",
    );

    const del = state.calls.find((c) => c.method === "delete");
    expect(del?.table).toBe("transactions");
    expect(del?.filters).toEqual({ id: "t-1", household_id: "h-1" });
  });
});
