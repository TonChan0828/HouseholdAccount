"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: number;
  /** 表示整形。既定は整数丸め。通貨は format={yen} を渡す。 */
  format?: (n: number) => string;
  durationMs?: number;
  className?: string;
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** value へ向けてカウントアップする数値。reduced-motion 時は即時表示。 */
export function AnimatedNumber({
  value,
  format = (n) => String(Math.round(n)),
  durationMs = 700,
  className,
}: Props) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
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
