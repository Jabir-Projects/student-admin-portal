"use client";

export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          alignItems: "center",
          background: "#f8fafc",
          color: "#172033",
          display: "flex",
          fontFamily: "system-ui, sans-serif",
          justifyContent: "center",
          margin: 0,
          minHeight: "100vh",
          padding: "24px",
        }}
      >
        <main style={{ maxWidth: "480px", textAlign: "center" }}>
          <h1>Portal unavailable</h1>
          <p>We could not load the application. Please try again.</p>
          <button
            onClick={unstable_retry}
            style={{
              background: "#155eef",
              border: 0,
              borderRadius: "8px",
              color: "white",
              cursor: "pointer",
              fontWeight: 600,
              marginTop: "16px",
              padding: "12px 18px",
            }}
            type="button"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
