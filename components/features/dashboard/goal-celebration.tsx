"use client";

import { useEffect, useState } from "react";

/**
 * 目標達成時に一度だけ舞う紙吹雪オーバーレイ（client）。
 *
 * - `prefers-reduced-motion` が有効な環境では描画しない。
 * - 1 セッションにつき一度だけ再生する（画面遷移のたびに繰り返さない）。
 * - 親要素を `relative overflow-hidden` にして内側に収める前提。
 */

// アプリのテーマトークンから祝祭色を拾う（緑＝income、金＝accent-warm、淡緑＝accent）。
const COLORS = [
  "var(--income)",
  "var(--accent-warm)",
  "var(--accent)",
  "var(--accent-warm-foreground)",
];

const PIECES = Array.from({ length: 16 }, (_, i) => i);
const SESSION_KEY = "shallet:goal-celebrated";

export function GoalCelebration() {
  const [play, setPlay] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // jsdom など matchMedia 非対応環境では再生しない。
    if (typeof window.matchMedia !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    sessionStorage.setItem(SESSION_KEY, "1");
    // effect 内での同期 setState を避けて次フレームで再生開始する。
    // 紙吹雪は CSS アニメ（fill-mode both）で最後に不可視になるため停止処理は不要。
    const raf = requestAnimationFrame(() => setPlay(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!play) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {PIECES.map((i) => {
        const left = (i * 6.3 + (i % 3) * 4) % 100;
        const color = COLORS[i % COLORS.length];
        const delay = (i % 6) * 90;
        const duration = 1800 + (i % 4) * 350;
        const size = 6 + (i % 3) * 2;
        return (
          <span
            key={i}
            data-goal-anim
            className="absolute top-0 rounded-[2px]"
            style={{
              left: `${left}%`,
              width: size,
              height: size * 1.6,
              background: color,
              animation: `goal-confetti ${duration}ms cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms both`,
            }}
          />
        );
      })}
    </div>
  );
}
