import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ScopeToggle } from "./scope-toggle";

describe("ScopeToggle", () => {
  it("全体/自分のリンクを表示する", () => {
    render(<ScopeToggle scope="all" />);

    const all = screen.getByRole("link", { name: "全体" });
    const mine = screen.getByRole("link", { name: "自分" });
    expect(all).toHaveAttribute("href", "/?scope=all");
    expect(mine).toHaveAttribute("href", "/?scope=mine");
  });

  it("現在のスコープ（全体）を強調する", () => {
    render(<ScopeToggle scope="all" />);

    expect(screen.getByRole("link", { name: "全体" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("link", { name: "自分" })).not.toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("現在のスコープ（自分）を強調する", () => {
    render(<ScopeToggle scope="mine" />);

    expect(screen.getByRole("link", { name: "自分" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("link", { name: "全体" })).not.toHaveAttribute(
      "aria-current",
      "true",
    );
  });
});
