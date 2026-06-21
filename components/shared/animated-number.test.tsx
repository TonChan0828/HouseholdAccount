import { act, render, screen } from "@testing-library/react";
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

  it("初回は 0 から value へ補間し、最終値のフラッシュを出さない", () => {
    forceReducedMotion(false);
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(
      (cb: FrameRequestCallback) => {
        frames.push(cb);
        return frames.length;
      },
    );
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    render(
      <AnimatedNumber
        value={100}
        durationMs={100}
        format={(n) => String(Math.round(n))}
      />,
    );

    // 描画前に開始値 0 へ差し替わる（value=100 のフラッシュは無い）。
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.queryByText("100")).not.toBeInTheDocument();

    // 中間フレーム t=0.5: eased = 1-(1-0.5)^3 = 0.875 -> 88（0 と 100 の間）。
    now = 50;
    act(() => {
      frames.shift()?.(now);
    });
    expect(screen.getByText("88")).toBeInTheDocument();

    // 最終フレーム t>=1: value に収束する。
    now = 100;
    act(() => {
      frames.shift()?.(now);
    });
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("value 変更時は前回値から新しい値へ補間する", () => {
    forceReducedMotion(false);
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(
      (cb: FrameRequestCallback) => {
        frames.push(cb);
        return frames.length;
      },
    );
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    const { rerender } = render(
      <AnimatedNumber value={100} durationMs={100} format={(n) => String(Math.round(n))} />,
    );
    // 初回アニメーションを完了させ、表示を 100 に収束させる。
    now = 100;
    act(() => {
      frames.shift()?.(now);
    });
    expect(screen.getByText("100")).toBeInTheDocument();

    // value を 200 に変更 → 0 ではなく 100 から補間する。
    frames.length = 0;
    rerender(
      <AnimatedNumber value={200} durationMs={100} format={(n) => String(Math.round(n))} />,
    );
    now = 150; // 変更後フレームの開始 now=100, t=0.5
    act(() => {
      frames.shift()?.(now);
    });
    // t=0.5, eased=0.875: 100 + (200-100)*0.875 = 187.5 -> 188（0 起点なら 88 になるはず）。
    expect(screen.getByText("188")).toBeInTheDocument();
  });

  it("アンマウント時に rAF をキャンセルする", () => {
    forceReducedMotion(false);
    vi.spyOn(performance, "now").mockReturnValue(0);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    const cancel = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => {});

    const { unmount } = render(<AnimatedNumber value={50} durationMs={100} />);
    unmount();
    expect(cancel).toHaveBeenCalled();
  });
});
