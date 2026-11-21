import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { TrendBars } from "./trend-bars";

it("負額はゼロ線から下に描画し、正額・負額に有効な高さを付ける", () => {
  render(<TrendBars data={[{ label: "2月", income: 2500, expense: -2500 }]} />);
  expect(screen.getByTitle("収入 ¥2,500")).toHaveStyle({ bottom: "50%", height: "50%" });
  expect(screen.getByTitle("支出 -¥2,500")).toHaveStyle({ top: "50%", height: "50%" });
});
