import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShalletLogo } from "./shallet-logo";

describe("ShalletLogo", () => {
  it("SVG ロゴをレンダリングし、className を適用する", () => {
    const { container } = render(<ShalletLogo className="size-9" />);

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveClass("size-9");
  });

  it("アクセシブルな名前 Shallet を持つ", () => {
    const { container } = render(<ShalletLogo />);

    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-label",
      "Shallet",
    );
  });
});
