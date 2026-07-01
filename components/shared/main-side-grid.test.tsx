import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MainSideGrid } from "./main-side-grid";

describe("MainSideGrid", () => {
  it("main と side の両方の内容を表示する", () => {
    render(
      <MainSideGrid
        main={<p>メインの内容</p>}
        side={<p>サイドの内容</p>}
      />,
    );

    expect(screen.getByText("メインの内容")).toBeInTheDocument();
    expect(screen.getByText("サイドの内容")).toBeInTheDocument();
  });

  it("lg 以上でメイン7:サイド5の2カラムグリッドになる", () => {
    render(
      <MainSideGrid
        main={<p>メインの内容</p>}
        side={<p>サイドの内容</p>}
      />,
    );

    const grid = screen.getByTestId("main-side-grid");
    expect(grid.className).toContain("lg:grid-cols-12");
    // 列の高さを独立させる（片方が短くても間延びさせない）
    expect(grid.className).toContain("lg:items-start");

    const [main, side] = Array.from(grid.children);
    expect((main as HTMLElement).className).toContain("lg:col-span-7");
    expect((side as HTMLElement).className).toContain("lg:col-span-5");
  });

  it("モバイルではラッパーが contents になり、子が外側グリッドに直接参加する", () => {
    render(
      <MainSideGrid
        main={<p>メインの内容</p>}
        side={<p>サイドの内容</p>}
      />,
    );

    const grid = screen.getByTestId("main-side-grid");
    const [main, side] = Array.from(grid.children);
    // contents（モバイル）→ lg:block（デスクトップで列になる）
    expect((main as HTMLElement).className).toContain("contents");
    expect((main as HTMLElement).className).toContain("lg:block");
    expect((side as HTMLElement).className).toContain("contents");
    expect((side as HTMLElement).className).toContain("lg:block");
  });

  it("className を外側グリッドにマージする", () => {
    render(
      <MainSideGrid
        main={<p>メインの内容</p>}
        side={<p>サイドの内容</p>}
        className="mt-4"
      />,
    );

    expect(screen.getByTestId("main-side-grid").className).toContain("mt-4");
  });
});
