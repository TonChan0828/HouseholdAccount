import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Hero } from "./hero";

describe("Hero", () => {
  it("ヘッドラインとサブコピーを表示する", () => {
    render(<Hero />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "家計を、みんなで一緒に。",
    );
    expect(screen.getByText(/グループで収支を共有し/)).toBeInTheDocument();
  });

  it("登録・ログインへの CTA リンクを持つ", () => {
    render(<Hero />);

    expect(
      screen.getByRole("link", { name: /無料で始める/ }),
    ).toHaveAttribute("href", "/register");
    expect(screen.getByRole("link", { name: "ログイン" })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
