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
  existingRow: null as
    | { created_by: string; on_behalf_of: string | null; amount?: number }
    | null,
  members: [] as { user_id: string; display_name: string }[],
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

vi.mock("@/lib/queries/members", () => ({
  getHouseholdMemberNames: async () => state.members,
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
          return query;
        },
        maybeSingle() {
          return Promise.resolve({ data: state.existingRow, error: null });
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

/** グループの別メンバー（名義人テスト用）。 */
const HANAKO = "22222222-2222-4222-8222-222222222222";

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

function updateFormData(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("id", "t-1");
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

beforeEach(() => {
  state.user = { id: "user-1" };
  state.householdId = "h-1";
  state.matchedRows = [{ id: "t-1" }];
  state.existingRow = { created_by: "user-1", on_behalf_of: null };
  state.members = [
    { user_id: "user-1", display_name: "太郎" },
    { user_id: HANAKO, display_name: "花子" },
  ];
  state.calls = [];
  vi.clearAllMocks();
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

  it("is_shared がチェックされていれば true で登録する", async () => {
    await expect(
      createTransaction(undefined, createFormData({ is_shared: "true" })),
    ).rejects.toThrow("NEXT_REDIRECT:/transactions");

    const insert = state.calls.find((c) => c.method === "insert");
    expect(insert?.values).toMatchObject({ is_shared: true });
  });

  it("is_shared 未指定は false で登録する", async () => {
    await expect(
      createTransaction(undefined, createFormData()),
    ).rejects.toThrow("NEXT_REDIRECT:/transactions");

    const insert = state.calls.find((c) => c.method === "insert");
    expect(insert?.values).toMatchObject({ is_shared: false });
  });

  it("_dialog=1 の場合は redirect せず成功状態を返す", async () => {
    const result = await createTransaction(
      undefined,
      createFormData({ _dialog: "1" }),
    );

    expect(result).toEqual({ ok: true, key: expect.any(String) });
    expect(state.calls.find((c) => c.method === "insert")).toBeDefined();
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

  it("取込の負額を編集できるが精算対象に変更できない", async () => {
    state.existingRow = { ...state.existingRow!, amount: -3500 };
    const protectedResult = await updateTransaction(undefined, updateFormData({ amount: "-4000", is_shared: "on" }));
    expect(protectedResult).toMatchObject({ error: expect.stringContaining("精算") });
    expect(state.calls.some((call) => call.method === "update")).toBe(false);
    await expect(updateTransaction(undefined, updateFormData({ amount: "-4000" })))
      .rejects.toThrow("NEXT_REDIRECT:/transactions");
    expect(state.calls.find((call) => call.method === "update")?.values).toMatchObject({ amount: -4000, is_shared: false });
  });

  it("対象が見つからない場合（他グループ・他人の取引）はエラーを返す", async () => {
    state.matchedRows = [];

    const result = await updateTransaction(undefined, updateFormData());

    expect(result).toEqual({ error: "対象の収支が見つかりません" });
  });

  it("_dialog=1 の場合は redirect せず成功状態を返す", async () => {
    const result = await updateTransaction(
      undefined,
      updateFormData({ _dialog: "1" }),
    );

    expect(result).toEqual({ ok: true, key: expect.any(String) });
    expect(state.calls.find((c) => c.method === "update")).toBeDefined();
  });

  it("_dialog=1 でも対象が見つからなければエラーを返す", async () => {
    state.matchedRows = [];

    const result = await updateTransaction(
      undefined,
      updateFormData({ _dialog: "1" }),
    );

    expect(result).toEqual({ error: "対象の収支が見つかりません" });
  });

  // 未訪問ルートまで無効化すると開発サーバの再コンパイルが多発して極端に遅くなるため、
  // revalidate は収支一覧に限定する（呼び出し元ルートは Server Action が自動で再描画する）。
  it("revalidate の対象を収支一覧に限定する", async () => {
    const { revalidatePath } = await import("next/cache");

    await updateTransaction(undefined, updateFormData({ _dialog: "1" }));

    const paths = vi.mocked(revalidatePath).mock.calls.map(([path]) => path);
    expect(paths).toEqual(["/transactions"]);
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

describe("代理入力（名義人・spec 41）", () => {
  it("名義人を指定すると on_behalf_of を付けて登録する", async () => {
    await expect(
      createTransaction(undefined, createFormData({ on_behalf_of: HANAKO })),
    ).rejects.toThrow("NEXT_REDIRECT:/transactions");

    const insert = state.calls.find((c) => c.method === "insert");
    expect(insert?.values).toMatchObject({
      created_by: "user-1",
      on_behalf_of: HANAKO,
    });
  });

  it("名義人が自分・未指定なら on_behalf_of は null にする", async () => {
    await expect(
      createTransaction(undefined, createFormData({ on_behalf_of: "" })),
    ).rejects.toThrow("NEXT_REDIRECT:/transactions");

    expect(
      state.calls.find((c) => c.method === "insert")?.values,
    ).toMatchObject({ on_behalf_of: null });
  });

  it("グループのメンバーでない名義人は拒否して登録しない", async () => {
    const outsider = "99999999-9999-4999-8999-999999999999";

    const result = await createTransaction(
      undefined,
      createFormData({ on_behalf_of: outsider }),
    );

    expect(result).toEqual({
      error: "名義人はグループのメンバーから選んでください",
    });
    expect(state.calls.find((c) => c.method === "insert")).toBeUndefined();
  });

  it("名義人本人が編集しても名義は外れない（入力者基準で正規化する）", async () => {
    // 太郎が花子名義で入力した収支を、花子自身が編集するケース。
    state.user = { id: HANAKO };
    state.existingRow = { created_by: "user-1", on_behalf_of: HANAKO };

    await expect(
      updateTransaction(undefined, updateFormData({ on_behalf_of: HANAKO })),
    ).rejects.toThrow("NEXT_REDIRECT:/transactions");

    expect(
      state.calls.find((c) => c.method === "update")?.values,
    ).toMatchObject({ on_behalf_of: HANAKO });
  });

  it("入力者でも名義人でもなければ編集できない", async () => {
    state.user = { id: "user-9" };
    state.existingRow = { created_by: "user-1", on_behalf_of: HANAKO };

    const result = await updateTransaction(undefined, updateFormData());

    expect(result).toEqual({ error: "対象の収支が見つかりません" });
    expect(state.calls.find((c) => c.method === "update")).toBeUndefined();
  });

  it("編集で名義人を付け替えられる", async () => {
    await expect(
      updateTransaction(undefined, updateFormData({ on_behalf_of: HANAKO })),
    ).rejects.toThrow("NEXT_REDIRECT:/transactions");

    expect(
      state.calls.find((c) => c.method === "update")?.values,
    ).toMatchObject({ on_behalf_of: HANAKO });
  });

  it("編集で名義人を解除できる", async () => {
    await expect(
      updateTransaction(undefined, updateFormData({ on_behalf_of: "" })),
    ).rejects.toThrow("NEXT_REDIRECT:/transactions");

    expect(
      state.calls.find((c) => c.method === "update")?.values,
    ).toMatchObject({ on_behalf_of: null });
  });
});
