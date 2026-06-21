import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Surface } from "./surface";

describe("Surface", () => {
  it("子要素を描画する", () => {
    render(<Surface>中身</Surface>);
    expect(screen.getByText("中身")).toBeInTheDocument();
  });

  it("raised バリアントで pillow 影クラスを付ける", () => {
    render(<Surface variant="raised">x</Surface>);
    const card = screen.getByText("x").closest('[data-slot="card"]');
    expect(card).toHaveClass("shadow-[var(--shadow-pillow)]");
  });

  it("sunken バリアントで sunken 背景クラスを付ける", () => {
    render(<Surface variant="sunken">y</Surface>);
    const card = screen.getByText("y").closest('[data-slot="card"]');
    expect(card).toHaveClass("bg-surface-sunken");
  });
});
