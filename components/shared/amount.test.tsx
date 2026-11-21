import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Amount } from "./amount";

describe("Amount", () => {
  it("収入は + 符号と income 色で表示する", () => {
    render(<Amount value={1000} type="income" />);
    const el = screen.getByText("+¥1,000");
    expect(el).toHaveClass("text-income");
  });

  it("支出は - 符号と expense 色で表示する", () => {
    render(<Amount value={500} type="expense" />);
    const el = screen.getByText("-¥500");
    expect(el).toHaveClass("text-expense");
  });

  it("showSign=false なら符号を出さない", () => {
    render(<Amount value={500} type="expense" showSign={false} />);
    expect(screen.getByText("¥500")).toBeInTheDocument();
  });

  it("負の value を渡しても符号は二重にならない", () => {
    render(<Amount value={-500} type="expense" />);
    expect(screen.getByText("-¥500")).toBeInTheDocument();
  });
});

it("同じ絶対額の通常支出と調整支出を見分けられる", () => {
  render(<><Amount value={3500} type="expense" /><Amount value={-3500} type="expense" /></>);
  expect(screen.getByText("調整")).toBeVisible();
  expect(screen.getAllByText("-¥3,500")).toHaveLength(2);
});
