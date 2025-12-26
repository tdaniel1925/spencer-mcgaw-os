"use client";

import { useEffect } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Global error boundary for root layout errors
 * This catches errors in the root layout itself
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Log error to Sentry in production only
    if (process.env.NODE_ENV === "production") {
      import("@sentry/nextjs").then((Sentry) => {
        Sentry.captureException(error);
      }).catch(() => {
        // Sentry not available
      });
    }
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: "28rem",
              width: "100%",
              textAlign: "center",
              padding: "2rem",
              border: "1px solid #e5e7eb",
              borderRadius: "0.5rem",
              backgroundColor: "#fff",
            }}
          >
            <div
              style={{
                width: "3rem",
                height: "3rem",
                margin: "0 auto 1rem",
                borderRadius: "50%",
                backgroundColor: "#fef2f2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#dc2626"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
            </div>

            <h1
              style={{
                fontSize: "1.25rem",
                fontWeight: 600,
                color: "#111827",
                marginBottom: "0.5rem",
              }}
            >
              Application Error
            </h1>

            <p
              style={{
                color: "#6b7280",
                marginBottom: "1.5rem",
              }}
            >
              A critical error occurred. Please try refreshing the page.
            </p>

            {process.env.NODE_ENV === "development" && (
              <div
                style={{
                  backgroundColor: "#f9fafb",
                  padding: "0.75rem",
                  borderRadius: "0.375rem",
                  marginBottom: "1rem",
                  textAlign: "left",
                  fontSize: "0.875rem",
                }}
              >
                <p style={{ color: "#dc2626", fontWeight: 500 }}>
                  {error.name}
                </p>
                <p style={{ color: "#6b7280", marginTop: "0.25rem" }}>
                  {error.message}
                </p>
                {error.digest && (
                  <p
                    style={{
                      color: "#9ca3af",
                      marginTop: "0.5rem",
                      fontSize: "0.75rem",
                    }}
                  >
                    Error ID: {error.digest}
                  </p>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={reset}
                style={{
                  flex: 1,
                  padding: "0.5rem 1rem",
                  backgroundColor: "#111827",
                  color: "#fff",
                  border: "none",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                }}
              >
                Try again
              </button>
              <a
                href="/"
                style={{
                  flex: 1,
                  padding: "0.5rem 1rem",
                  backgroundColor: "#fff",
                  color: "#111827",
                  border: "1px solid #e5e7eb",
                  borderRadius: "0.375rem",
                  textDecoration: "none",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                Go home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
