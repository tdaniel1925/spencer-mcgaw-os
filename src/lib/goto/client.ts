/**
 * GoTo Connect API Client
 *
 * Handles authentication, API calls, and subscription management
 * for GoTo Connect phone system integration.
 *
 * API Documentation: https://developer.goto.com/GoToConnect
 */

import { db } from "@/db";
import { sql } from "drizzle-orm";
import logger from "@/lib/logger";

const GOTO_API_BASE = "https://api.goto.com";
const GOTO_AUTH_BASE = "https://authentication.logmeininc.com";

// OAuth token storage interface
interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  accountKey: string;
}

// In-memory cache for quick access (backed by database)
let tokenCache: TokenData | null = null;

/**
 * GoTo Connect OAuth Configuration
 */
export interface GoToConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  accountKey: string;
}

function getConfig(): GoToConfig {
  const clientId = process.env.GOTO_CLIENT_ID;
  const clientSecret = process.env.GOTO_CLIENT_SECRET;
  const redirectUri = process.env.GOTO_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/goto/callback`;
  const accountKey = process.env.GOTO_ACCOUNT_KEY;

  if (!clientId || !clientSecret) {
    throw new Error("GoTo Connect credentials not configured. Set GOTO_CLIENT_ID and GOTO_CLIENT_SECRET.");
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    accountKey: accountKey || "",
  };
}

/**
 * Generate OAuth authorization URL
 */
export function getAuthorizationUrl(state?: string): string {
  const config = getConfig();
  const scopes = [
    // Call events
    "call-events.v1.notifications.manage",
    "call-events.v1.events.read",
    // Call history/reports
    "cr.v1.read",
    "call-history.v1.notifications.manage",
    // Recordings & Transcripts
    "recording.v1.read",
    "recording.v1.notifications.manage",
    // Voicemail access
    "voicemail.v1.voicemails.read",
    "voicemail.v1.notifications.manage",
  ].join(" ");

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: config.redirectUri,
    scope: scopes,
    ...(state && { state }),
  });

  return `${GOTO_AUTH_BASE}/oauth/authorize?${params.toString()}`;
}

/**
 * Save tokens to database
 */
async function saveTokensToDatabase(tokens: TokenData, channelId?: string, webhookUrl?: string): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE integrations
      SET
        access_token = ${tokens.accessToken},
        refresh_token = ${tokens.refreshToken},
        token_expires_at = ${new Date(tokens.expiresAt).toISOString()}::timestamptz,
        account_key = ${tokens.accountKey},
        channel_id = COALESCE(${channelId || null}, channel_id),
        webhook_url = COALESCE(${webhookUrl || null}, webhook_url),
        is_connected = true,
        error_message = NULL,
        updated_at = NOW()
      WHERE provider = 'goto'
    `);
  } catch (error) {
    logger.error("[GoTo Client] Failed to save tokens to database", error);
    throw error;
  }
}

/**
 * Load tokens from database
 */
async function loadTokensFromDatabase(): Promise<TokenData | null> {
  try {
    const result = await db.execute<{
      access_token: string | null;
      refresh_token: string | null;
      token_expires_at: string | null;
      account_key: string | null;
    }>(sql`
      SELECT
        access_token,
        refresh_token,
        token_expires_at,
        account_key
      FROM integrations
      WHERE provider = 'goto' AND is_connected = true
    `);

    const row = result[0];

    if (!row || !row.access_token || !row.refresh_token) {
      return null;
    }

    return {
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      expiresAt: row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0,
      accountKey: row.account_key || "",
    };
  } catch (error) {
    logger.error("[GoTo Client] Failed to load tokens from database", error);
    return null;
  }
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<TokenData> {
  const config = getConfig();

  const response = await fetch(`${GOTO_AUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }

  const data = await response.json();

  tokenCache = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    accountKey: data.account_key || config.accountKey,
  };

  // Save to database for persistence
  await saveTokensToDatabase(tokenCache);

  return tokenCache;
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(): Promise<TokenData> {
  // Try to load from database if not in cache
  if (!tokenCache) {
    tokenCache = await loadTokensFromDatabase();
  }

  if (!tokenCache?.refreshToken) {
    throw new Error("No refresh token available. Re-authorization required.");
  }

  const config = getConfig();

  const response = await fetch(`${GOTO_AUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokenCache.refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    tokenCache = null;
    // Mark integration as disconnected in database
    await db.execute(sql`
      UPDATE integrations
      SET is_connected = false, error_message = ${`Token refresh failed: ${error}`}
      WHERE provider = 'goto'
    `);
    throw new Error(`Failed to refresh token: ${error}`);
  }

  const data = await response.json();

  tokenCache = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || tokenCache.refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
    accountKey: tokenCache.accountKey,
  };

  // Save refreshed tokens to database
  await saveTokensToDatabase(tokenCache);

  return tokenCache;
}

/**
 * Get valid access token (refresh if needed)
 */
export async function getAccessToken(): Promise<string> {
  // Try to load from database if not in cache
  if (!tokenCache) {
    tokenCache = await loadTokensFromDatabase();
  }

  if (!tokenCache) {
    throw new Error("Not authenticated with GoTo Connect. Authorization required.");
  }

  // Refresh if token expires in less than 5 minutes
  if (tokenCache.expiresAt - Date.now() < 5 * 60 * 1000) {
    await refreshAccessToken();
  }

  return tokenCache.accessToken;
}

/**
 * Set tokens from stored data (e.g., from database)
 */
export function setTokens(tokens: TokenData): void {
  tokenCache = tokens;
}

/**
 * Check if authenticated (async version that checks database)
 */
export async function isAuthenticatedAsync(): Promise<boolean> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return true;
  }
  // Try to load from database
  const dbTokens = await loadTokensFromDatabase();
  if (dbTokens && dbTokens.expiresAt > Date.now()) {
    tokenCache = dbTokens;
    return true;
  }
  // Try to refresh if we have a refresh token
  if (dbTokens?.refreshToken) {
    try {
      await refreshAccessToken();
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Check if authenticated (sync version, uses cache only)
 */
export function isAuthenticated(): boolean {
  return tokenCache !== null && tokenCache.expiresAt > Date.now();
}

/**
 * Get account key
 */
export async function getAccountKeyAsync(): Promise<string> {
  if (tokenCache?.accountKey) {
    return tokenCache.accountKey;
  }
  const dbTokens = await loadTokensFromDatabase();
  if (dbTokens?.accountKey) {
    tokenCache = dbTokens;
    return dbTokens.accountKey;
  }
  return process.env.GOTO_ACCOUNT_KEY || "";
}

/**
 * Get account key (sync version)
 */
export function getAccountKey(): string {
  return tokenCache?.accountKey || process.env.GOTO_ACCOUNT_KEY || "";
}

/**
 * Make authenticated API request to GoTo Connect
 */
export async function gotoApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${GOTO_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GoTo API error (${response.status}): ${error}`);
  }

  // Handle empty responses
  const text = await response.text();
  if (!text) return {} as T;

  return JSON.parse(text) as T;
}

// =============================================================================
// NOTIFICATION CHANNEL API
// =============================================================================

export interface NotificationChannel {
  channelId: string;
  channelType: "Webhook" | "WebSocket";
  webhookChannelData?: {
    webhook: {
      url: string;
    };
  };
}

/**
 * Create a webhook notification channel
 */
export async function createWebhookChannel(
  webhookUrl: string,
  channelId?: string
): Promise<NotificationChannel> {
  const id = channelId || `webhook-${Date.now()}`;

  const response = await gotoApiRequest<NotificationChannel>(
    `/notification-channel/v1/channels/${id}`,
    {
      method: "POST",
      body: JSON.stringify({
        channelType: "Webhook",
        webhookChannelData: {
          webhook: {
            url: webhookUrl,
          },
        },
      }),
    }
  );

  return response;
}

/**
 * Delete a notification channel
 */
export async function deleteChannel(channelId: string): Promise<void> {
  await gotoApiRequest(`/notification-channel/v1/channels/${channelId}`, {
    method: "DELETE",
  });
}

// =============================================================================
// CALL EVENTS SUBSCRIPTION API
// =============================================================================

export interface CallEventSubscription {
  channelId: string;
  accountKeys: Array<{
    id: string;
    events: string[];
  }>;
}

/**
 * Subscribe to call events
 */
export async function subscribeToCallEvents(
  channelId: string,
  events: string[] = ["STARTING", "ENDING", "ACTIVE"]
): Promise<void> {
  const accountKey = getAccountKey();

  if (!accountKey) {
    throw new Error("GoTo account key not configured. Set GOTO_ACCOUNT_KEY.");
  }

  await gotoApiRequest("/call-events/v1/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      channelId,
      accountKeys: [
        {
          id: accountKey,
          events,
        },
      ],
    }),
  });
}

/**
 * Subscribe to call reports (for completed call data)
 */
export async function subscribeToCallReports(channelId: string): Promise<void> {
  const accountKey = getAccountKey();

  if (!accountKey) {
    throw new Error("GoTo account key not configured. Set GOTO_ACCOUNT_KEY.");
  }

  await gotoApiRequest("/call-events-report/v1/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      channelId,
      eventTypes: ["REPORT_SUMMARY"],
      accountKeys: [accountKey],
    }),
  });
}

/**
 * Subscribe to recording notifications (for when recordings are ready)
 */
export async function subscribeToRecordingNotifications(channelId: string): Promise<void> {
  const accountKey = getAccountKey();

  if (!accountKey) {
    throw new Error("GoTo account key not configured. Set GOTO_ACCOUNT_KEY.");
  }

  try {
    await gotoApiRequest("/recording/v1/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        channelId,
        accountKey,
        events: ["RECORDING_READY", "TRANSCRIPTION_READY"],
      }),
    });
  } catch {
    // Recording subscription may not be available for all accounts - silently continue
  }
}

// =============================================================================
// CALL REPORTS API
// =============================================================================

export interface CallReport {
  conversationSpaceId: string;
  callCreated: string;
  callEnded: string;
  direction: "OUTBOUND" | "INBOUND";
  accountKey: string;
  participants: Array<{
    id: string;
    legId: string;
    originator: boolean;
    type: string;
  }>;
  callStates?: unknown[];
}

/**
 * Get call report by conversation space ID
 */
export async function getCallReport(conversationSpaceId: string): Promise<CallReport> {
  return gotoApiRequest<CallReport>(
    `/call-events-report/v1/reports/${conversationSpaceId}`
  );
}

/**
 * Browse recent call report summaries
 */
export async function getRecentCallReports(
  startTime: Date,
  endTime: Date = new Date()
): Promise<Array<{ conversationSpaceId: string }>> {
  const accountKey = getAccountKey();

  const params = new URLSearchParams({
    accountKey,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
  });

  return gotoApiRequest<Array<{ conversationSpaceId: string }>>(
    `/call-events-report/v1/report-summaries?${params.toString()}`
  );
}

// =============================================================================
// RECORDING API
// =============================================================================

export interface Recording {
  recordingId: string;
  contentUrl?: string;
  duration?: number;
  createdAt?: string;
}

/**
 * Get recording content URL
 * Returns a proxy URL that can be used in browser audio elements
 * The proxy handles OAuth authentication with GoTo
 */
export async function getRecordingUrl(recordingId: string): Promise<string> {
  // Verify the recording exists by fetching content info
  const response = await gotoApiRequest<{
    url?: string;
    token?: { token: string; expires: string };
    status?: string;
  }>(`/recording/v1/recordings/${recordingId}/content`);

  // If recording exists (has token or url), return our proxy URL
  if (response.token?.token || response.url || response.status === "UPLOADED") {
    // Return our proxy URL instead of the direct GoTo URL
    // This allows browser audio elements to access the recording
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    return `${appUrl}/api/recordings/${recordingId}`;
  }

  throw new Error("No recording available");
}

/**
 * Get transcription for a recording
 * GoTo returns transcription in a results array with utterances
 * Channel 0 = Staff (internal user), Channel 1 = Caller (external)
 */
export async function getTranscription(
  transcriptId: string
): Promise<{ text: string; segments?: Array<{ start: number; end: number; text: string; speaker: string }> }> {
  const response = await gotoApiRequest<{
    version?: string;
    results?: Array<{
      type: string;
      transcript: string;
      final: boolean;
      startTimeMs: number;
      endTimeMs: number;
      channel: number;
      languageCode: string;
    }>;
  }>(`/recording/v1/transcriptions/${transcriptId}`);

  // Extract text from results array
  if (response.results && Array.isArray(response.results)) {
    // Sort by start time and combine transcripts
    const sortedResults = response.results
      .filter(r => r.type === "utterances" && r.transcript)
      .sort((a, b) => a.startTimeMs - b.startTimeMs);

    // Format with speaker labels
    // Channel 0 = Staff (internal user receiving/making call)
    // Channel 1 = Caller (external party)
    const getSpeaker = (channel: number) => channel === 0 ? "Staff" : "Caller";

    // Group consecutive utterances from same speaker
    const formattedLines: string[] = [];
    let currentSpeaker: string | null = null;
    let currentText: string[] = [];

    for (const r of sortedResults) {
      const speaker = getSpeaker(r.channel);
      const text = r.transcript.trim();

      if (speaker !== currentSpeaker) {
        // New speaker - save previous if exists
        if (currentSpeaker && currentText.length > 0) {
          formattedLines.push(`${currentSpeaker}: ${currentText.join(" ")}`);
        }
        currentSpeaker = speaker;
        currentText = [text];
      } else {
        // Same speaker - append to current
        currentText.push(text);
      }
    }

    // Don't forget the last speaker
    if (currentSpeaker && currentText.length > 0) {
      formattedLines.push(`${currentSpeaker}: ${currentText.join(" ")}`);
    }

    const text = formattedLines.join("\n\n");
    const segments = sortedResults.map(r => ({
      start: r.startTimeMs / 1000,
      end: r.endTimeMs / 1000,
      text: r.transcript.trim(),
      speaker: getSpeaker(r.channel),
    }));

    return { text, segments };
  }

  return { text: "" };
}

// =============================================================================
// SETUP HELPER
// =============================================================================

export interface SetupResult {
  channelId: string;
  webhookUrl: string;
  subscriptions: string[];
}

/**
 * Complete setup: Create channel and subscribe to events
 */
export async function setupGoToIntegration(webhookUrl: string): Promise<SetupResult> {
  const channel = await createWebhookChannel(webhookUrl);

  await subscribeToCallEvents(channel.channelId);

  await subscribeToCallReports(channel.channelId);

  await subscribeToRecordingNotifications(channel.channelId);

  // Update database with channel info
  if (tokenCache) {
    await saveTokensToDatabase(tokenCache, channel.channelId, webhookUrl);
  }

  return {
    channelId: channel.channelId,
    webhookUrl,
    subscriptions: ["call-events", "call-reports", "recording-notifications"],
  };
}

/**
 * Get integration status from database
 */
export async function getIntegrationStatus(): Promise<{
  isConnected: boolean;
  accountKey: string | null;
  channelId: string | null;
  webhookUrl: string | null;
  lastSyncedAt: string | null;
  errorMessage: string | null;
}> {
  try {
    const result = await db.execute<{
      is_connected: boolean;
      account_key: string | null;
      channel_id: string | null;
      webhook_url: string | null;
      last_synced_at: string | null;
      error_message: string | null;
      token_expires_at: string | null;
    }>(sql`
      SELECT
        is_connected,
        account_key,
        channel_id,
        webhook_url,
        last_synced_at,
        error_message,
        token_expires_at
      FROM integrations
      WHERE provider = 'goto'
    `);

    const row = result[0];

    if (!row) {
      return {
        isConnected: false,
        accountKey: null,
        channelId: null,
        webhookUrl: null,
        lastSyncedAt: null,
        errorMessage: null,
      };
    }

    // Check if token is expired
    const tokenExpired = row.token_expires_at
      ? new Date(row.token_expires_at).getTime() < Date.now()
      : true;

    return {
      isConnected: row.is_connected && !tokenExpired,
      accountKey: row.account_key,
      channelId: row.channel_id,
      webhookUrl: row.webhook_url,
      lastSyncedAt: row.last_synced_at,
      errorMessage: tokenExpired ? "Token expired, please reconnect" : row.error_message,
    };
  } catch (error) {
    logger.error("[GoTo Client] Failed to get integration status", error);
    return {
      isConnected: false,
      accountKey: null,
      channelId: null,
      webhookUrl: null,
      lastSyncedAt: null,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Disconnect GoTo integration - clears tokens and marks as disconnected
 */
export async function disconnectGoTo(): Promise<void> {
  // Clear in-memory token cache
  tokenCache = null;

  // Update database to clear tokens and mark disconnected
  await db.execute(sql`
    UPDATE integrations
    SET
      is_connected = false,
      access_token = NULL,
      refresh_token = NULL,
      token_expires_at = NULL,
      channel_id = NULL,
      error_message = 'Disconnected by user'
    WHERE provider = 'goto'
  `);
}

/**
 * Full diagnostic check for GoTo Connect integration
 * Tests OAuth, API access, and webhook subscriptions
 */
export async function runDiagnostics(): Promise<{
  oauth: { status: "ok" | "error"; message: string };
  apiAccess: { status: "ok" | "error"; message: string };
  webhookChannel: { status: "ok" | "error" | "not_configured"; message: string; channelId?: string };
  subscriptions: { status: "ok" | "error" | "unknown"; message: string };
  recentCalls: { status: "ok" | "error"; count: number; message: string };
  webhookUrl: string;
  recommendations: string[];
}> {
  const recommendations: string[] = [];
  const status = await getIntegrationStatus();
  const webhookUrl = status.webhookUrl || `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/goto`;

  // 1. Check OAuth
  let oauthStatus: { status: "ok" | "error"; message: string };
  try {
    const authenticated = await isAuthenticatedAsync();
    if (authenticated) {
      oauthStatus = { status: "ok", message: "OAuth tokens are valid" };
    } else {
      oauthStatus = { status: "error", message: "Not authenticated - OAuth required" };
      recommendations.push("Click 'Connect GoTo' to authenticate with OAuth");
    }
  } catch (error) {
    oauthStatus = { status: "error", message: error instanceof Error ? error.message : "OAuth check failed" };
    recommendations.push("Re-authenticate with GoTo Connect");
  }

  // 2. Check API Access
  let apiAccessStatus: { status: "ok" | "error"; message: string };
  if (oauthStatus.status === "ok") {
    try {
      const accountKey = await getAccountKeyAsync();
      if (accountKey) {
        // Try to make a simple API call
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        await getRecentCallReports(oneDayAgo);
        apiAccessStatus = { status: "ok", message: `API access working (Account: ${accountKey})` };
      } else {
        apiAccessStatus = { status: "error", message: "No account key configured" };
        recommendations.push("Set GOTO_ACCOUNT_KEY in environment variables");
      }
    } catch (error) {
      apiAccessStatus = { status: "error", message: error instanceof Error ? error.message : "API access failed" };
      recommendations.push("Check GoTo API permissions and account key");
    }
  } else {
    apiAccessStatus = { status: "error", message: "Skipped - OAuth not valid" };
  }

  // 3. Check Webhook Channel
  let webhookChannelStatus: { status: "ok" | "error" | "not_configured"; message: string; channelId?: string };
  if (status.channelId) {
    webhookChannelStatus = {
      status: "ok",
      message: `Webhook channel configured`,
      channelId: status.channelId
    };
  } else {
    webhookChannelStatus = {
      status: "not_configured",
      message: "No webhook channel configured - calls won't be received"
    };
    recommendations.push("Click 'Setup Webhooks' to configure call notifications");
  }

  // 4. Check Subscriptions (we can't directly query this, so estimate based on channel)
  let subscriptionsStatus: { status: "ok" | "error" | "unknown"; message: string };
  if (status.channelId) {
    subscriptionsStatus = {
      status: "unknown",
      message: "Channel exists - subscriptions should be active. If no calls coming in, try re-running setup."
    };
  } else {
    subscriptionsStatus = {
      status: "error",
      message: "No channel configured - no subscriptions active"
    };
  }

  // 5. Check Recent Calls from GoTo API
  let recentCallsStatus: { status: "ok" | "error"; count: number; message: string };
  if (apiAccessStatus.status === "ok") {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const reports = await getRecentCallReports(oneDayAgo);
      const count = reports.length;
      if (count > 0) {
        recentCallsStatus = {
          status: "ok",
          count,
          message: `${count} calls in last 24 hours from GoTo API`
        };
      } else {
        recentCallsStatus = {
          status: "ok",
          count: 0,
          message: "No calls in last 24 hours (this is normal if no one called)"
        };
      }
    } catch (error) {
      recentCallsStatus = {
        status: "error",
        count: 0,
        message: error instanceof Error ? error.message : "Failed to fetch recent calls"
      };
    }
  } else {
    recentCallsStatus = { status: "error", count: 0, message: "Skipped - API access not working" };
  }

  // Final recommendations
  if (webhookChannelStatus.status === "ok" && recentCallsStatus.count === 0) {
    recommendations.push("No calls in last 24 hours - this is normal if no one has called");
  }
  if (webhookChannelStatus.status === "ok" && recentCallsStatus.count > 0) {
    recommendations.push(`GoTo shows ${recentCallsStatus.count} calls but none in app? Check webhook URL is accessible: ${webhookUrl}`);
  }

  return {
    oauth: oauthStatus,
    apiAccess: apiAccessStatus,
    webhookChannel: webhookChannelStatus,
    subscriptions: subscriptionsStatus,
    recentCalls: recentCallsStatus,
    webhookUrl,
    recommendations,
  };
}
