import { beforeEach, describe, expect, it, vi } from "vitest";

import { resendConfirmation, signIn, signOut, signUp } from "./actions";

const state = vi.hoisted(() => ({
  rateLimit: "allowed" as "allowed" | "limited" | "unavailable",
  signUpError: null as { message: string } | null,
  signUpArgs: null as unknown,
  signInArgs: null as unknown,
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
      signInWithPassword: async (args: unknown) => {
        state.signInArgs = args;
        return { error: null };
      },
      resend: async (args: unknown) => {
        state.resendArgs = args;
        return { error: null };
      },
      signOut: async () => ({ error: null }),
    },
  }),
}));
vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: async () => state.rateLimit,
  RATE_LIMIT_UNAVAILABLE_MESSAGE: "一時的に利用できません",
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
  state.rateLimit = "allowed";
  state.signUpError = null;
  state.signUpArgs = null;
  state.signInArgs = null;
  state.resendArgs = null;
});

it("制限基盤の障害時は認証処理を実行しない", async () => {
  state.rateLimit = "unavailable";
  expect(await signIn(undefined, formDataWith(validForm))).toEqual({ error: "一時的に利用できません" });
  expect(await signUp(undefined, formDataWith(validForm))).toEqual({ error: "一時的に利用できません" });
  expect(state.signInArgs).toBeNull();
  expect(state.signUpArgs).toBeNull();
});

it("制限基盤の障害時も確認メールの再送では存在を明かさない", async () => {
  state.rateLimit = "unavailable";
  expect(await resendConfirmation(undefined, formDataWith({ email: validForm.email }))).toEqual({ success: true });
  expect(state.resendArgs).toBeNull();
});

describe("signIn", () => {
  it("安全な next パスへリダイレクトする", async () => {
    await expect(
      signIn(
        undefined,
        formDataWith({ ...validForm, next: "/invite/abc_123" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/invite/abc_123");

    expect(state.signInArgs).toEqual(validForm);
  });

  it("外部 URL の next は拒否してグループ一覧へ戻す", async () => {
    await expect(
      signIn(
        undefined,
        formDataWith({ ...validForm, next: "https://evil.example" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/households");
  });
});

describe("signUp", () => {
  it("成功時は emailRedirectTo 付きで signUp を呼び、/verify-email へリダイレクトする", async () => {
    await expect(signUp(undefined, formDataWith(validForm))).rejects.toThrow(
      "NEXT_REDIRECT:/verify-email?email=new%40example.com&next=%2Fhouseholds",
    );

    expect(state.signUpArgs).toEqual({
      email: "new@example.com",
      password: "Password1!",
      options: {
        emailRedirectTo:
          "http://localhost:3000/auth/callback?next=%2Fhouseholds",
      },
    });
  });

  it("安全な next を確認メールと案内画面へ引き継ぐ", async () => {
    await expect(
      signUp(
        undefined,
        formDataWith({ ...validForm, next: "/invite/abc_123" }),
      ),
    ).rejects.toThrow(
      "NEXT_REDIRECT:/verify-email?email=new%40example.com&next=%2Finvite%2Fabc_123",
    );

    expect(state.signUpArgs).toEqual({
      ...validForm,
      options: {
        emailRedirectTo:
          "http://localhost:3000/auth/callback?next=%2Finvite%2Fabc_123",
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
        emailRedirectTo:
          "http://localhost:3000/auth/callback?next=%2Fhouseholds",
      },
    });
  });

  it("安全な next を再送メールへ引き継ぎ、外部 URL は拒否する", async () => {
    await resendConfirmation(
      undefined,
      formDataWith({
        email: "new@example.com",
        next: "/invite/abc_123",
      }),
    );
    expect(state.resendArgs).toEqual({
      type: "signup",
      email: "new@example.com",
      options: {
        emailRedirectTo:
          "http://localhost:3000/auth/callback?next=%2Finvite%2Fabc_123",
      },
    });

    await resendConfirmation(
      undefined,
      formDataWith({
        email: "new@example.com",
        next: "//evil.example",
      }),
    );
    expect(state.resendArgs).toEqual({
      type: "signup",
      email: "new@example.com",
      options: {
        emailRedirectTo:
          "http://localhost:3000/auth/callback?next=%2Fhouseholds",
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

describe("signOut", () => {
  it("サインアウト後に LP（/?loggedout=1）へリダイレクトする", async () => {
    await expect(signOut()).rejects.toThrow("NEXT_REDIRECT:/?loggedout=1");
  });
});
