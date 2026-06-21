"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Props = {
  value: number;
  /** 表示整形。既定は整数丸め。通貨は format={yen} を渡す。 */
  format?: (n: number) => string;
  /** カウントアップの所要時間(ms)。既定 700。 */
  durationMs?: number;
  className?: string;
};

/** SSR では useLayoutEffect が警告を出すため、クライアントのみ layout effect を使う。 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * value へ向けてカウントアップする数値。初回マウントは 0 から、以降は前回値から
 * 補間する。reduced-motion 時は即時に value を表示する。
 * 初期レンダリングは value を描画して SSR とハイドレーションを一致させ、描画前に
 * レイアウトエフェクトで開始値へ差し替えるため、最終値が一瞬見えるフラッシュは起きない。
 */
export function AnimatedNumber({
  value,
  format = (n) => String(Math.round(n)),
  durationMs = 700,
  className,
}: Props) {
  const [display, setDisplay] = useState(value);
  // null = まだ一度もアニメーションしていない（初回マウント）。
  const fromRef = useRef<number | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current ?? 0;
    setDisplay(from);
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return <span className={className}>{format(display)}</span>;
}
