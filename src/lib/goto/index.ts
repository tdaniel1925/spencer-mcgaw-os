/**
 * GoTo Connect Integration
 *
 * Provides phone call recording, transcription, and event tracking
 * from GoTo Connect phone system.
 */

export * from "./client";

// Re-export commonly used functions for easier imports
export {
  runDiagnostics,
  setupGoToIntegration,
  getIntegrationStatus,
  isAuthenticatedAsync,
  getAuthorizationUrl,
  getRecentCallReports,
  disconnectGoTo,
} from "./client";
