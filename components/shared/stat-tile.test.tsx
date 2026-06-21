import { render, screen } from "@testing-library/react";
import { TrendingUp } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StatTile } from "./stat-tile";

afterEach(() => {
  vi.restoreAllMocks();
});

/** AnimatedNumber を即値表示にするため reduced-motion を強制する。 */
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

describe("StatTile", () => {
  it("ラベルと整形済みの値を表示する", () => {
    forceReducedMotion();
    render(
      <StatTile
        label="収入"
        value={1000}
        icon={TrendingUp}
        tone="income"
        format={(n) => `¥${Math.round(n)}`}
      />,
    );
    expect(screen.getByText("収入")).toBeInTheDocument();
    expect(screen.getByText("¥1000")).toBeInTheDocument();
  });
});
