import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LandingHeader } from "./landing-header";

vi.mock("@/components/features/layout/theme-toggle", () => ({
  ThemeToggleButton: () => <button type="button">テーマを切り替え</button>,
}));

describe("LandingHeader", () => {
  it("ログイン・登録リンクを表示する", () => {
    render(<LandingHeader />);

    expect(screen.getByRole("link", { name: "ログイン" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(
      screen.getByRole("link", { name: /無料で始める/ }),
    ).toHaveAttribute("href", "/register");
  });

  it("テーマ切り替えを表示する", () => {
    render(<LandingHeader />);

    expect(
      screen.getByRole("button", { name: "テーマを切り替え" }),
    ).toBeInTheDocument();
  });
});
