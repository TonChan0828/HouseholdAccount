import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShalletMark } from "./shallet-mark";

describe("ShalletMark", () => {
  it("SVG ロゴをレンダリングし、className を適用する", () => {
    const { container } = render(<ShalletMark className="size-5" />);

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveClass("size-5");
  });

  it("装飾目的のため aria-hidden を持つ", () => {
    const { container } = render(<ShalletMark />);

    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
