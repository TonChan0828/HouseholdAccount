"use client";

export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="ja">
      <body>
        <main
          style={{
            alignItems: "center",
            display: "flex",
            flexDirection: "column",
            fontFamily: "system-ui, sans-serif",
            gap: "1rem",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "1.5rem",
            textAlign: "center",
          }}
        >
          <h1>問題が発生しました</h1>
          <p>一時的な問題の可能性があります。もう一度お試しください。</p>
          <button type="button" onClick={unstable_retry}>
            もう一度試す
          </button>
        </main>
      </body>
    </html>
  );
}
