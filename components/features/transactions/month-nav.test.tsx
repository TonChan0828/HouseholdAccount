import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MonthNav } from "./month-nav";

describe("MonthNav", () => {
  it("期間ラベルと前後ナビのリンクを表示する", () => {
    render(
      <MonthNav
        label="2026/06/01 〜 2026/06/30"
        prevHref="/transactions?ref=2026-05-01"
        nextHref="/transactions?ref=2026-07-01"
      />,
    );
    expect(
      screen.getByText("2026/06/01 〜 2026/06/30"),
    ).toBeInTheDocument();

    const prev = screen.getByRole("link", { name: "前の期間" });
    const next = screen.getByRole("link", { name: "次の期間" });
    expect(prev).toHaveAttribute("href", "/transactions?ref=2026-05-01");
    expect(next).toHaveAttribute("href", "/transactions?ref=2026-07-01");
  });
});
