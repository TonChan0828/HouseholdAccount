import { beforeEach, describe, expect, it, vi } from "vitest";

import { revalidatePath } from "next/cache";

import {
  createCategory,
  deleteCategory,
  reorderCategories,
  toggleCategoryReminder,
} from "./actions";

const state = vi.hoisted(() => ({
  updates: [] as { table: string; values: unknown; filters: [string, unknown][] }[],
  inserts: [] as { table: string; values: unknown }[],
  insertError: null as { code: string } | null,
  rpcCalls: [] as { name: string; args: Record<string, unknown> }[],
  rpcError: null as { message: string } | null,
  deletes: [] as { table: string; filters: [string, unknown][]; selected: string | null }[],
  deleteResult: { data: [{ id: "c-1" }], error: null } as {
    data: { id: string }[] | null;
    error: { message: string } | null;
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));

vi.mock("@/lib/household", () => ({
  requireDashboardContext: async () => {
    const { createClient } = await import("@/lib/supabase/server");
    return {
      user: { id: "u-1" },
      householdId: "h-1",
      supabase: await createClient(),
    };
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc: (name: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ name, args });
      return Promise.resolve({ error: state.rpcError });
    },
    from: (table: string) => ({
      insert: (values: unknown) => ({
        then: (resolve: (v: unknown) => unknown) => {
          state.inserts.push({ table, values });
          return resolve({ error: state.insertError });
        },
      }),
      update: (values: unknown) => {
        const filters: [string, unknown][] = [];
        const chain = {
          eq: (col: string, val: unknown) => {
            filters.push([col, val]);
            return chain;
          },
          then: (resolve: (v: unknown) => unknown) => {
            state.updates.push({ table, values, filters });
            return resolve({ error: null });
          },
        };
        return chain;
      },
      delete: () => {
        const record = { table, filters: [] as [string, unknown][], selected: null as string | null };
        state.deletes.push(record);
        const chain = {
          eq: (col: string, val: unknown) => {
            record.filters.push([col, val]);
            return chain;
          },
          select: (columns: string) => {
            record.selected = columns;
            return chain;
          },
          then: (resolve: (v: unknown) => unknown) =>
            resolve(
              record.selected
                ? state.deleteResult
                : { data: null, error: state.deleteResult.error },
            ),
        };
        return chain;
      },
    }),
  }),
}));

function formDataWith(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [k, v] of Object.entries(fields)) formData.set(k, v);
  return formData;
}

beforeEach(() => {
  state.updates = [];
  state.inserts = [];
  state.insertError = null;
  state.rpcCalls = [];
  state.rpcError = null;
  state.deletes = [];
  state.deleteResult = { data: [{ id: "c-1" }], error: null };
  vi.mocked(revalidatePath).mockClear();
});

describe("createCategory", () => {
  it("DBが同種別の正規化重複名を拒否したら利用者向けエラーを返す", async () => {
    state.insertError = { code: "23505" };
    const result = await createCategory(
      undefined,
      formDataWith({ name: " groceries ", color: "#ef4444", type: "expense" }),
    );

    expect(result).toEqual({
      error: "同じ種別のカテゴリに同じ名前が既にあります",
    });
    expect(state.inserts).toEqual([
      {
        table: "categories",
        values: {
          household_id: "h-1",
          name: "groceries",
          color: "#ef4444",
          type: "expense",
          icon: null,
          is_default: false,
        },
      },
    ]);
  });
});

describe("toggleCategoryReminder", () => {
  it("id と household_id でスコープして reminder_enabled を更新する（is_default 制限なし）", async () => {
    await toggleCategoryReminder(
      formDataWith({ id: "c-1", reminder_enabled: "true" }),
    );
    expect(state.updates).toEqual([
      {
        table: "categories",
        values: { reminder_enabled: true },
        filters: [
          ["id", "c-1"],
          ["household_id", "h-1"],
        ],
      },
    ]);
  });

  it("reminder_enabled=false も反映する", async () => {
    await toggleCategoryReminder(
      formDataWith({ id: "c-1", reminder_enabled: "false" }),
    );
    expect(state.updates[0].values).toEqual({ reminder_enabled: false });
  });

  it("id が無ければ何もしない", async () => {
    await toggleCategoryReminder(formDataWith({ reminder_enabled: "true" }));
    expect(state.updates).toHaveLength(0);
  });
});

describe("reorderCategories", () => {
  it("household と type をサーバー側で固定して順序全体をRPCへ送る", async () => {
    const ids = [
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
    ];
    await reorderCategories(
      formDataWith({ type: "expense", category_ids: JSON.stringify(ids) }),
    );

    expect(state.rpcCalls).toEqual([
      {
        name: "reorder_categories",
        args: {
          _household_id: "h-1",
          _type: "expense",
          _category_ids: ids,
        },
      },
    ]);
  });

  it("RPCが競合・無効な順序を拒否した場合、再読み込みを促す", async () => {
    state.rpcError = { message: "stale category order" };
    const ids = ["00000000-0000-4000-8000-000000000001"];

    await expect(
      reorderCategories(
        formDataWith({ type: "expense", category_ids: JSON.stringify(ids) }),
      ),
    ).rejects.toThrow("redirect:/categories?sortError=conflict");
  });

  it("不正なJSONや種別をDBへ送らない", async () => {
    await expect(
      reorderCategories(
        formDataWith({ type: "unsupported", category_ids: "not-json" }),
      ),
    ).rejects.toThrow("redirect:/categories?sortError=invalid");
    expect(state.rpcCalls).toHaveLength(0);
  });
});

describe("deleteCategory", () => {
  it("id・household_id・is_default=false でスコープし、削除した行を取得する", async () => {
    await expect(
      deleteCategory(undefined, formDataWith({ id: "c-1" })),
    ).rejects.toThrow("redirect:/categories?deleted=1");

    expect(state.deletes).toHaveLength(1);
    expect(state.deletes[0]).toMatchObject({
      table: "categories",
      selected: "id",
      filters: [
        ["id", "c-1"],
        ["household_id", "h-1"],
        ["is_default", false],
      ],
    });
  });

  it("削除に成功したら参照画面を再検証してから完了表示へ遷移する", async () => {
    await expect(
      deleteCategory(undefined, formDataWith({ id: "c-1" })),
    ).rejects.toThrow("redirect:/categories?deleted=1");

    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("削除が 0 件ならエラーを返し、成功として遷移しない", async () => {
    state.deleteResult = { data: [], error: null };

    const result = await deleteCategory(undefined, formDataWith({ id: "c-1" }));

    expect(result).toEqual({
      error:
        "このカテゴリは削除できませんでした（既に削除済み、またはデフォルトカテゴリです）。一覧を再読み込みしてください。",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/categories");
  });

  it("DB がエラーを返したらエラーを返し、遷移しない", async () => {
    state.deleteResult = { data: null, error: { message: "boom" } };

    const result = await deleteCategory(undefined, formDataWith({ id: "c-1" }));

    expect(result).toEqual({
      error: "カテゴリの削除に失敗しました。時間をおいて再度お試しください。",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("id が空なら DB を呼ばずにエラーを返す", async () => {
    const result = await deleteCategory(undefined, formDataWith({}));

    expect(result).toEqual({ error: "対象が指定されていません" });
    expect(state.deletes).toHaveLength(0);
  });
});
