import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AnimatedNumber } from "./animated-number";

afterEach(() => {
  vi.restoreAllMocks();
});

/** reduced-motion を強制するため matchMedia を上書きする。 */
function forceReducedMotion(reduced: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: reduced,
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

describe("AnimatedNumber", () => {
  it("reduced-motion では最終値を即時表示する", () => {
    forceReducedMotion(true);
    render(<AnimatedNumber value={1234} format={(n) => `¥${Math.round(n)}`} />);
    expect(screen.getByText("¥1234")).toBeInTheDocument();
  });

  it("アニメーション後に最終値を表示する", async () => {
    forceReducedMotion(false);
    render(
      <AnimatedNumber value={500} durationMs={30} format={(n) => `${Math.round(n)}`} />,
    );
    expect(await screen.findByText("500")).toBeInTheDocument();
  });
});
