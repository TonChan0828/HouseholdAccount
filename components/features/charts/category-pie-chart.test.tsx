import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CategoryPieChart } from "./category-pie-chart";

describe("CategoryPieChart", () => {
  it("データが空のときプレースホルダを表示する", () => {
    render(<CategoryPieChart data={[]} />);
    expect(
      screen.getByText("当期の支出はまだありません。"),
    ).toBeInTheDocument();
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
