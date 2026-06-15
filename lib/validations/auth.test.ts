import { describe, expect, it } from "vitest";

import {
  loginSchema,
  passwordUpdateSchema,
  registerSchema,
  resetRequestSchema,
} from "./auth";

describe("loginSchema", () => {
  it("正しいメールとパスワードを受け付ける", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "secret123",
    });
    expect(result.success).toBe(true);
  });

  it("不正なメール形式を拒否する", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "secret123",
    });
    expect(result.success).toBe(false);
  });

  it("6文字未満のパスワードを拒否する", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "12345",
    });
    expect(result.success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("ポリシーを満たすパスワードを受け付ける", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "Secret123!",
    });
    expect(result.success).toBe(true);
  });

  it("空のメールを拒否する", () => {
    const result = registerSchema.safeParse({
      email: "",
      password: "Secret123!",
    });
    expect(result.success).toBe(false);
  });

  it("8文字未満のパスワードを拒否する", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "Ab1!",
    });
    expect(result.success).toBe(false);
  });

  it("英大文字・数字・記号を含まないパスワードを拒否する", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "password",
    });
    expect(result.success).toBe(false);
  });

  it("記号を含まないパスワードを拒否する", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "Secret123",
    });
    expect(result.success).toBe(false);
  });
});

describe("resetRequestSchema", () => {
  it("正しいメールを受け付ける", () => {
    const result = resetRequestSchema.safeParse({ email: "user@example.com" });
    expect(result.success).toBe(true);
  });

  it("不正なメール形式を拒否する", () => {
    const result = resetRequestSchema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
  });
});

describe("passwordUpdateSchema", () => {
  it("ポリシーを満たし一致するパスワードを受け付ける", () => {
    const result = passwordUpdateSchema.safeParse({
      password: "Secret123!",
      confirmPassword: "Secret123!",
    });
    expect(result.success).toBe(true);
  });

  it("ポリシー違反のパスワードを拒否する", () => {
    const result = passwordUpdateSchema.safeParse({
      password: "12345",
      confirmPassword: "12345",
    });
    expect(result.success).toBe(false);
  });

  it("確認用と一致しない場合を拒否する", () => {
    const result = passwordUpdateSchema.safeParse({
      password: "Secret123!",
      confirmPassword: "Secret124!",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("パスワードが一致しません");
    }
  });
});
