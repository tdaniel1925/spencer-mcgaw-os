// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Define how likely traces are sampled. Adjust this value in production,
  // or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Replay configuration
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,

  // Integrations
  integrations: [
    Sentry.replayIntegration({
      // Mask all text content and form inputs
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Filter out known benign errors
  ignoreErrors: [
    // Random browser plugins/extensions
    "top.GLOBALS",
    // Chrome extensions
    "chrome-extension://",
    // Firefox extensions
    "moz-extension://",
    // Safari extensions
    "safari-extension://",
    // Network errors
    "NetworkError",
    "Failed to fetch",
    "Load failed",
    // Cancelled requests
    "AbortError",
    "The operation was aborted",
  ],

  // Only send errors in production
  enabled: process.env.NODE_ENV === "production",
});
