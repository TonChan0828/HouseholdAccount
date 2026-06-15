/**
 * Shallet のフラットロゴ（簡易版）。
 *
 * ファビコンのイラストを単純化し、クリーム色の角丸チップに「2人のメンバー + 緑の財布 + S」を
 * 配したフラット SVG。共有（みんなで）と家計（財布）を表す。自前で配色を持つため、
 * 緑バッジで囲まず単体で使う。サイズは className（例: `size-9`）で制御する。
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
      {/* 左のメンバー（緑・財布の後ろから覗く） */}
      <circle cx="11.5" cy="9.4" r="2.7" fill="#93CB9F" />
      <path d="M6.6 16.5 a4.9 4.9 0 0 1 9.8 0 Z" fill="#93CB9F" />
      {/* 右のメンバー（青・少し前面で高い） */}
      <circle cx="19.8" cy="8.6" r="2.9" fill="#8FC0E8" />
      <path d="M14.5 16.5 a5.3 5.3 0 0 1 10.6 0 Z" fill="#8FC0E8" />
      {/* 財布本体（上部・明るい緑） */}
      <rect x="4.7" y="15.2" width="22.6" height="12.4" rx="3" fill="#6BB083" />
      {/* 財布の前ポケット（濃い緑） */}
      <path
        d="M4.7 19.2 H27.3 V24.6 A3 3 0 0 1 24.3 27.6 H7.7 A3 3 0 0 1 4.7 24.6 Z"
        fill="#4F9468"
      />
      {/* 留め具 */}
      <circle cx="23.4" cy="23" r="1.4" fill="#FBE6A6" />
      {/* S モノグラム（財布前面） */}
      <path
        d="M15.6 19.6 H11.9 A1.75 1.75 0 0 0 11.9 23.1 H13.8 A1.75 1.75 0 0 1 13.8 26.6 H10.1"
        fill="none"
        stroke="#FBF8EF"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
