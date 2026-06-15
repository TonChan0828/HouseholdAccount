/**
 * Shallet のブランドロゴ（"S" モノグラム）。
 *
 * `share` + `wallet` の頭文字 S を、$（お金）を思わせる曲線で描いたカスタム SVG。
 * `currentColor` を使うため、角丸バッジ内では `text-primary-foreground` などの
 * 文字色をそのまま継承する。サイズは className（例: `size-5`）で制御する。
 */
export function ShalletMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M16.5 5.5H10a3.25 3.25 0 0 0 0 6.5h4a3.25 3.25 0 0 1 0 6.5H7" />
    </svg>
  );
}
