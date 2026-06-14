import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LandingFooter } from "./landing-footer";

describe("LandingFooter", () => {
  it("コピーライトとログインリンクを表示する", () => {
    render(<LandingFooter />);

    expect(screen.getByText(/家計簿アプリ/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ログイン" })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
