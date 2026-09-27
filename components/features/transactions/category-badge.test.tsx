import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CategoryBadge } from "./category-badge";

describe("CategoryBadge", () => {
  it("カテゴリ名と色ドットを表示する", () => {
    render(<CategoryBadge category={{ name: "食費", color: "#ef4444" }} />);

    expect(screen.getByText("食費")).toBeInTheDocument();
  });

  it("設定済みアイコンを表示する", () => {
    const { container } = render(
      <CategoryBadge category={{ name: "ペット", color: "#22c55e", icon: "paw-print" }} />,
    );
    expect(screen.getByText("ペット")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("カテゴリが無いときは未分類と表示する", () => {
    render(<CategoryBadge category={null} />);

    expect(screen.getByText("未分類")).toBeInTheDocument();
  });
});
