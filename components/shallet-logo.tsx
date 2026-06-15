/**
 * Shallet のフラットロゴ（簡易版）。
 *
 * ファビコンのイラストを単純化し、クリーム色の角丸チップに「緑の財布 + コイン + S」を
 * 配したフラット SVG。自前で配色を持つため、緑バッジで囲まず単体で使う。
 * サイズは className（例: `size-9`）で制御する。
 */
export function ShalletLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role="img"
      aria-label="Shallet"
    >
      {/* 背景チップ */}
      <rect
        x="0.75"
        y="0.75"
        width="30.5"
        height="30.5"
        rx="8"
        fill="#FAF4E4"
        stroke="#00000014"
        strokeWidth="1"
      />
      {/* コイン（財布の上に覗く） */}
      <circle cx="16" cy="9.7" r="4.6" fill="#F4C44E" />
      <circle cx="16" cy="9.7" r="3.2" fill="none" stroke="#E0A436" strokeWidth="0.9" />
      <circle cx="14.4" cy="8.2" r="1" fill="#FBE6A6" />
      {/* 財布本体（上部・明るい緑） */}
      <rect x="4.5" y="13.6" width="23" height="14" rx="3.2" fill="#6BB083" />
      {/* 財布の前ポケット（濃い緑） */}
      <path
        d="M4.5 18.3 H27.5 V24.4 A3.2 3.2 0 0 1 24.3 27.6 H7.7 A3.2 3.2 0 0 1 4.5 24.4 Z"
        fill="#4F9468"
      />
      {/* 留め具 */}
      <circle cx="23.6" cy="22.9" r="1.5" fill="#FBE6A6" />
      {/* S モノグラム（財布前面） */}
      <path
        d="M16.4 18.9 H12.2 A1.9 1.9 0 0 0 12.2 22.7 H14.4 A1.9 1.9 0 0 1 14.4 26.5 H10.2"
        fill="none"
        stroke="#FBF8EF"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
