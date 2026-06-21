/**
 * 全画面に敷く装飾レイヤー。ゆっくり呼吸するグロー2つと極薄グレインを重ね、
 * クリーム/深緑のベースに光と質感を与える。動きは motion-safe のみ。
 */
const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function AmbientBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute -right-[10%] -top-[15%] size-[45rem] rounded-full bg-accent/40 blur-3xl motion-safe:animate-[breathe_18s_ease-in-out_infinite]" />
      <div className="absolute -left-[15%] top-[25%] size-[38rem] rounded-full bg-accent-warm/25 blur-3xl motion-safe:animate-[breathe_22s_ease-in-out_infinite]" />
      <div
        className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06]"
        style={{ backgroundImage: NOISE, backgroundSize: "120px 120px" }}
      />
    </div>
  );
}
