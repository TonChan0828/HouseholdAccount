import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AmbientBackground } from "./ambient-background";

describe("AmbientBackground", () => {
  it("装飾レイヤーを aria-hidden / pointer-events-none で描画する", () => {
    const { container } = render(<AmbientBackground />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).not.toBeNull();
    expect(root).toHaveAttribute("aria-hidden");
    expect(root).toHaveClass("pointer-events-none");
    expect(root).toHaveClass("fixed");
  });
});
