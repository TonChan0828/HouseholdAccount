import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, rpc } = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc }),
}));

vi.mock("@/app/households/actions", () => ({
  acceptInvitation: vi.fn(),
}));

import InvitePage from "./page";

describe("InvitePage", () => {
  beforeEach(() => {
    rpc.mockReset();
    getUser.mockReset();
    getUser.mockResolvedValue({ data: { user: null }, error: null });
  });

  it("形式不正なトークンは DB に渡さず、値も画面へ露出しない", async () => {
    const token = "secret?email=user@example.com";
    render(await InvitePage({ params: Promise.resolve({ token }) }));

    expect(rpc).not.toHaveBeenCalled();
    expect(screen.getByText("この招待リンクは無効です。")).toBeVisible();
    expect(screen.queryByDisplayValue(token)).not.toBeInTheDocument();
  });

  it("未ログインでは招待内容と認証後に戻る導線だけを表示する", async () => {
    const token = "a".repeat(32);
    rpc.mockResolvedValue({
      data: [{ status: "valid", household_name: "テスト家計簿" }],
      error: null,
    });

    render(await InvitePage({ params: Promise.resolve({ token }) }));

    expect(rpc).toHaveBeenCalledWith("invitation_preview", { _token: token });
    expect(screen.getByText(/テスト家計簿/)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "このグループに参加する" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(token)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ログインして参加" })).toHaveAttribute(
      "href",
      `/login?next=%2Finvite%2F${token}`,
    );
    expect(screen.getByRole("link", { name: "新規登録して参加" })).toHaveAttribute(
      "href",
      `/register?next=%2Finvite%2F${token}`,
    );
  });

  it("ログイン済みなら参加操作を表示する", async () => {
    const token = "b".repeat(32);
    rpc.mockResolvedValue({
      data: [{ status: "valid", household_name: "テスト家計簿" }],
      error: null,
    });
    getUser.mockResolvedValue({
      data: { user: { id: "user-id" } },
      error: null,
    });

    render(await InvitePage({ params: Promise.resolve({ token }) }));

    expect(
      screen.getByRole("button", { name: "このグループに参加する" }),
    ).toBeVisible();
    expect(screen.getByDisplayValue(token)).toHaveAttribute("type", "hidden");
  });

  it("存在しない正規形式トークンでは参加操作を表示しない", async () => {
    const token = "z".repeat(32);
    rpc.mockResolvedValue({
      data: [{ status: "not_found", household_name: null }],
      error: null,
    });

    render(await InvitePage({ params: Promise.resolve({ token }) }));

    expect(screen.getByText("この招待リンクは無効です。")).toBeVisible();
    expect(screen.queryByRole("button", { name: "このグループに参加する" })).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(token)).not.toBeInTheDocument();
  });
});
