import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({ user: null as { id: string } | null }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user } }),
    },
  }),
}));

import { updateSession } from "./middleware";

describe("updateSession public request boundaries", () => {
  beforeEach(() => {
    state.user = null;
  });

  it("未認証の招待ページ GET を通す", async () => {
    const response = await updateSession(
      new NextRequest(`https://example.com/invite/${"x".repeat(32)}`),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("未認証の招待ページ POST は公開しない", async () => {
    const response = await updateSession(
      new NextRequest(`https://example.com/invite/${"x".repeat(32)}`, {
        method: "POST",
      }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.com/login");
  });

  it("未認証の CSP report POST だけを通す", async () => {
    const post = await updateSession(
      new NextRequest("https://example.com/api/csp-report", { method: "POST" }),
    );
    const get = await updateSession(
      new NextRequest("https://example.com/api/csp-report", { method: "GET" }),
    );

    expect(post.status).toBe(200);
    expect(post.headers.get("location")).toBeNull();
    expect(get.status).toBe(307);
    expect(get.headers.get("location")).toBe("https://example.com/login");
  });

  it("未認証の保護ルートは引き続きログインへ戻す", async () => {
    const response = await updateSession(
      new NextRequest("https://example.com/dashboard"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.com/login");
  });
});
