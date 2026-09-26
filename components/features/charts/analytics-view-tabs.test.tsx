import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnalyticsViewTabs } from "./analytics-view-tabs";

describe("AnalyticsViewTabs", () => {
  it("月次・年間の両ビューへのリンクを表示する", () => {
    render(<AnalyticsViewTabs active="month" />);
    expect(screen.getByRole("link", { name: "月次" })).toHaveAttribute(
      "href",
      "/analytics",
    );
    expect(screen.getByRole("link", { name: "年間" })).toHaveAttribute(
      "href",
      "/analytics?view=year",
    );
  });

  it("アクティブなビューに aria-current を付ける", () => {
    render(<AnalyticsViewTabs active="year" />);
    expect(screen.getByRole("link", { name: "年間" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "月次" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
