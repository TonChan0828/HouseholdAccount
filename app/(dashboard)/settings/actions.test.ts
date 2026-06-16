import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteAccount } from "./actions";

const state = vi.hoisted(() => ({
  user: null as { id: string; email: string | null } | null,
  rpcError: null as { message: string } | null,
  rpcCalls: [] as string[],
  signOutCalls: 0,
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

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user } }),
      signOut: async () => {
        state.signOutCalls += 1;
        return { error: null };
      },
    },
    rpc: async (fn: string) => {
      state.rpcCalls.push(fn);
      return { data: null, error: state.rpcError };
    },
  }),
}));

function formDataWith(confirmText: string) {
  const formData = new FormData();
  formData.set("confirmText", confirmText);
  return formData;
}

beforeEach(() => {
  state.user = { id: "user-1", email: "me@example.com" };
  state.rpcError = null;
  state.rpcCalls = [];
  state.signOutCalls = 0;
});

describe("deleteAccount", () => {
  it("未ログインの場合は /login にリダイレクトし削除しない", async () => {
    state.user = null;

    await expect(
      deleteAccount(undefined, formDataWith("me@example.com")),
    ).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(state.rpcCalls).toHaveLength(0);
  });

  it("確認フレーズがメールアドレスと一致しない場合はエラーを返し削除しない", async () => {
    const result = await deleteAccount(undefined, formDataWith("wrong@example.com"));

    expect(result).toEqual({ error: expect.any(String) });
    expect(state.rpcCalls).toHaveLength(0);
  });

  it("RPC がエラーを返した場合はエラーを返す", async () => {
    state.rpcError = { message: "boom" };

    const result = await deleteAccount(undefined, formDataWith("me@example.com"));

    expect(result).toEqual({ error: expect.any(String) });
    expect(state.rpcCalls).toEqual(["delete_own_account"]);
    expect(state.signOutCalls).toBe(0);
  });

  it("成功時は delete_own_account を呼び、サインアウトして /login?deleted=1 へリダイレクトする", async () => {
    await expect(
      deleteAccount(undefined, formDataWith("me@example.com")),
    ).rejects.toThrow("NEXT_REDIRECT:/login?deleted=1");

    expect(state.rpcCalls).toEqual(["delete_own_account"]);
    expect(state.signOutCalls).toBe(1);
  });
});
