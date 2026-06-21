import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SectionHeading } from "./section-heading";

describe("SectionHeading", () => {
  it("見出しを h2 として描画する", () => {
    render(<SectionHeading>カテゴリ別支出</SectionHeading>);
    expect(
      screen.getByRole("heading", { level: 2, name: "カテゴリ別支出" }),
    ).toBeInTheDocument();
  });

  it("index を2桁ゼロ詰めで表示する", () => {
    render(<SectionHeading index={1}>x</SectionHeading>);
    expect(screen.getByText("01")).toBeInTheDocument();
  });

  it("index 未指定なら番号を出さない", () => {
    render(<SectionHeading>x</SectionHeading>);
    expect(screen.queryByText("01")).not.toBeInTheDocument();
  });
});
