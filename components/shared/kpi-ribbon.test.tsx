import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { KpiRibbon } from "./kpi-ribbon";

afterEach(() => {
  vi.restoreAllMocks();
});

function forceReducedMotion() {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: true,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}

describe("KpiRibbon", () => {
  it("全項目のラベルと値・単位を表示する", () => {
    forceReducedMotion();
    render(
      <KpiRibbon
        items={[
          { label: "当期収入", value: 1000, format: (n) => `¥${Math.round(n)}` },
          { label: "支出カテゴリ", value: 11, unit: "件" },
        ]}
      />,
    );
    expect(screen.getByText("当期収入")).toBeInTheDocument();
    expect(screen.getByText("¥1000")).toBeInTheDocument();
    expect(screen.getByText("支出カテゴリ")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();
    expect(screen.getByText("件")).toBeInTheDocument();
  });
});
