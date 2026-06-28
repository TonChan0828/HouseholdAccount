import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ViewToggle } from "./view-toggle";

describe("ViewToggle", () => {
  it("リスト・カレンダーの両ビューへのリンクを表示する", () => {
    render(<ViewToggle active="list" />);
    expect(screen.getByRole("link", { name: "リスト" })).toHaveAttribute(
      "href",
      "/transactions",
    );
    expect(screen.getByRole("link", { name: "カレンダー" })).toHaveAttribute(
      "href",
      "/calendar",
    );
  });

  it("アクティブなビューに aria-current を付ける", () => {
    render(<ViewToggle active="calendar" />);
    expect(screen.getByRole("link", { name: "カレンダー" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "リスト" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
