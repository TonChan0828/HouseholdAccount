import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { Amount } from "./amount";

it("同じ絶対額の通常支出と調整支出を見分けられる", () => {
  render(<><Amount value={3500} type="expense" /><Amount value={-3500} type="expense" /></>);
  expect(screen.getByText("調整")).toBeVisible();
  expect(screen.getAllByText("-¥3,500")).toHaveLength(2);
});
