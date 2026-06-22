import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateGroupDisplayName } from "./actions";

const state = vi.hoisted(() => ({
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

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
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
  state.rpcCalls = [];
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
