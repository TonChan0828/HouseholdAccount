import { describe, expect, it } from "vitest";

import { loginSchema, registerSchema } from "./auth";

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
  it("正しい入力を受け付ける", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "secret123",
    });
    expect(result.success).toBe(true);
  });

  it("空のメールを拒否する", () => {
    const result = registerSchema.safeParse({ email: "", password: "secret123" });
    expect(result.success).toBe(false);
  });
});
