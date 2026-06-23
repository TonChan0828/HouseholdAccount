import { beforeEach, describe, expect, it, vi } from "vitest";

import { resendConfirmation, signUp } from "./actions";

const state = vi.hoisted(() => ({
  signUpError: null as { message: string } | null,
  signUpArgs: null as unknown,
  resendArgs: null as unknown,
}));

vi.mock("next/navigation", () => ({
  // 実際の redirect と同様に例外を投げて処理を中断させる
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => (name === "origin" ? "http://localhost:3000" : null),
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signUp: async (args: unknown) => {
        state.signUpArgs = args;
        return { error: state.signUpError };
      },
      resend: async (args: unknown) => {
        state.resendArgs = args;
        return { error: null };
      },
    },
  }),
}));

function formDataWith(entries: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  return formData;
}

const validForm = { email: "new@example.com", password: "Password1!" };

beforeEach(() => {
  state.signUpError = null;
  state.signUpArgs = null;
  state.resendArgs = null;
});

describe("signUp", () => {
  it("成功時は emailRedirectTo 付きで signUp を呼び、/verify-email へリダイレクトする", async () => {
    await expect(signUp(undefined, formDataWith(validForm))).rejects.toThrow(
      "NEXT_REDIRECT:/verify-email?email=new%40example.com",
    );

    expect(state.signUpArgs).toEqual({
      email: "new@example.com",
      password: "Password1!",
      options: {
        emailRedirectTo: "http://localhost:3000/auth/callback?next=/households",
      },
    });
  });

  it("入力が不正な場合はエラーを返し signUp を呼ばない", async () => {
    const result = await signUp(
      undefined,
      formDataWith({ email: "bad", password: "short" }),
    );

    expect(result).toEqual({ error: expect.any(String) });
    expect(state.signUpArgs).toBeNull();
  });

  it("signUp がエラーを返した場合はエラーを返す", async () => {
    state.signUpError = { message: "boom" };

    const result = await signUp(undefined, formDataWith(validForm));

    expect(result).toEqual({ error: "boom" });
  });
});

describe("resendConfirmation", () => {
  it("type=signup・emailRedirectTo 付きで resend を呼び success を返す", async () => {
    const result = await resendConfirmation(
      undefined,
      formDataWith({ email: "new@example.com" }),
    );

    expect(result).toEqual({ success: true });
    expect(state.resendArgs).toEqual({
      type: "signup",
      email: "new@example.com",
      options: {
        emailRedirectTo: "http://localhost:3000/auth/callback?next=/households",
      },
    });
  });

  it("メール形式が不正な場合はエラーを返し resend を呼ばない", async () => {
    const result = await resendConfirmation(
      undefined,
      formDataWith({ email: "bad" }),
    );

    expect(result).toEqual({ error: expect.any(String) });
    expect(state.resendArgs).toBeNull();
  });
});
