import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CategoryPieChart } from "./category-pie-chart";

describe("CategoryPieChart", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("データが空のときプレースホルダを表示する", () => {
    render(<CategoryPieChart data={[]} />);
    expect(
      screen.getByText("当期の支出はまだありません。"),
    ).toBeInTheDocument();
  });

  it("マウント時に ResponsiveContainer の寸法警告を出さない", () => {
    // jsdom の getBoundingClientRect は常に 0 を返すため、実ブラウザ相当の実寸を返させる。
    // これにより警告源は「初回レンダーの初期寸法(-1)」に限定され、initialDimension 修正の有無を判別できる。
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      width: 192,
      height: 192,
      top: 0,
      left: 0,
      right: 192,
      bottom: 192,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <CategoryPieChart
        data={[
          { categoryId: "c1", name: "食費", color: "#f00", amount: 32000 },
        ]}
      />,
    );
    const dimensionWarning = warn.mock.calls.some((args) =>
      String(args[0]).includes("should be greater than 0"),
    );
    expect(dimensionWarning).toBe(false);
  });

  it("データがあるとき凡例にカテゴリ名と金額を表示する", () => {
    render(
      <CategoryPieChart
        data={[
          { categoryId: "c1", name: "食費", color: "#f00", amount: 32000 },
        ]}
      />,
    );
    expect(screen.getByText("食費")).toBeInTheDocument();
    expect(screen.getByText("¥32,000")).toBeInTheDocument();
    expect(
      screen.queryByText("当期の支出はまだありません。"),
    ).not.toBeInTheDocument();
  });
});
