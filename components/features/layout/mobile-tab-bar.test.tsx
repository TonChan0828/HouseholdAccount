import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MobileTabBar } from "./mobile-tab-bar";

const usePathnameMock = vi.fn(() => "/");

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

describe("MobileTabBar", () => {
  it("主要タブと記録ボタンを表示する", () => {
    render(<MobileTabBar />);

    expect(screen.getByRole("link", { name: "ホーム" })).toHaveAttribute("href", "/");
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
    expect(screen.getByRole("link", { name: /記録/ })).toHaveAttribute(
      "href",
      "/transactions/new",
    );
  });

  it("現在のタブをアクティブ表示する", () => {
    usePathnameMock.mockReturnValue("/analytics");
    render(<MobileTabBar />);

    expect(screen.getByRole("link", { name: "分析" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "ホーム" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
