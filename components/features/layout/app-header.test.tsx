import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AppHeader } from "./app-header";

const usePathnameMock = vi.fn(() => "/");

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

function renderHeader() {
  return render(
    <AppHeader
      householdName="わが家"
      displayName="show"
      signOutAction={vi.fn()}
    />,
  );
}

describe("AppHeader", () => {
  it("主要ページへのナビリンクを表示する", () => {
    renderHeader();

    expect(screen.getByRole("link", { name: "ホーム" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "収支" })).toHaveAttribute(
      "href",
      "/transactions",
    );
    expect(screen.getByRole("link", { name: "分析" })).toHaveAttribute(
      "href",
      "/analytics",
    );
    expect(screen.getByRole("link", { name: "メンバー" })).toHaveAttribute(
      "href",
      "/members",
    );
    expect(screen.getByRole("link", { name: "カテゴリ" })).toHaveAttribute(
      "href",
      "/categories",
    );
  });

  it("現在のページをアクティブ表示する", () => {
    usePathnameMock.mockReturnValue("/transactions/new");
    renderHeader();

    expect(screen.getByRole("link", { name: "収支" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "ホーム" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("収支を記録ボタンを表示する", () => {
    renderHeader();

    expect(screen.getByRole("link", { name: /収支を記録/ })).toHaveAttribute(
      "href",
      "/transactions/new",
    );
  });

  it("ユーザーメニューにテーマ切り替えを表示する", async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: /show/ }));

    expect(
      await screen.findByRole("menuitemradio", { name: "ライト" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemradio", { name: "ダーク" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemradio", { name: "システム" }),
    ).toBeInTheDocument();
  });

  it("ユーザーメニューにグループ名とグループ切替・ログアウトを表示する", async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: /show/ }));

    expect(await screen.findByText("わが家")).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /グループを切り替え/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /カテゴリ管理/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /ログアウト/ }),
    ).toBeInTheDocument();
  });

  it("ユーザーメニューにプロフィール設定へのリンクを表示する", async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: /show/ }));

    expect(
      await screen.findByRole("menuitem", { name: /プロフィール設定/ }),
    ).toHaveAttribute("href", "/settings");
  });
});
