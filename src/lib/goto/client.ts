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
    console.log("[GoTo Client] Tokens saved to database");
  } catch (error) {
    console.error("[GoTo Client] Failed to save tokens to database:", error);
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
    console.error("[GoTo Client] Failed to load tokens from database:", error);
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
    console.log("[GoTo Client] Loading tokens from database...");
    tokenCache = await loadTokensFromDatabase();
  }

  if (!tokenCache) {
    throw new Error("Not authenticated with GoTo Connect. Authorization required.");
  }

  // Refresh if token expires in less than 5 minutes
  if (tokenCache.expiresAt - Date.now() < 5 * 60 * 1000) {
    console.log("[GoTo Client] Token expiring soon, refreshing...");
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
    console.log("[GoTo] Subscribed to recording notifications");
  } catch (error) {
    // Recording subscription may not be available for all accounts
    console.warn("[GoTo] Could not subscribe to recording notifications:", error);
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
 * GoTo API returns a token that must be used to construct the download URL
 */
export async function getRecordingUrl(recordingId: string): Promise<string> {
  const response = await gotoApiRequest<{
    url?: string;
    token?: { token: string; expires: string };
    status?: string;
  }>(`/recording/v1/recordings/${recordingId}/content`);

  // If we get a direct URL, use it
  if (response.url) {
    return response.url;
  }

  // If we get a token, construct the download URL
  if (response.token?.token) {
    return `https://api.goto.com/recording/v1/recordings/${recordingId}/download?token=${encodeURIComponent(response.token.token)}`;
  }

  throw new Error("No recording URL or token returned from API");
}

/**
 * Get transcription for a recording
 */
export async function getTranscription(
  transcriptId: string
): Promise<{ text: string; segments?: Array<{ start: number; end: number; text: string }> }> {
  return gotoApiRequest(`/recording/v1/transcriptions/${transcriptId}`);
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
  console.log("[GoTo Setup] Creating webhook channel...");
  const channel = await createWebhookChannel(webhookUrl);
  console.log("[GoTo Setup] Channel created:", channel.channelId);

  console.log("[GoTo Setup] Subscribing to call events...");
  await subscribeToCallEvents(channel.channelId);

  console.log("[GoTo Setup] Subscribing to call reports...");
  await subscribeToCallReports(channel.channelId);

  console.log("[GoTo Setup] Subscribing to recording notifications...");
  await subscribeToRecordingNotifications(channel.channelId);

  // Update database with channel info
  if (tokenCache) {
    await saveTokensToDatabase(tokenCache, channel.channelId, webhookUrl);
  }

  console.log("[GoTo Setup] Setup complete!");

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
    console.error("[GoTo Client] Failed to get integration status:", error);
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
  console.log("[GoTo Client] Disconnecting integration...");

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

  console.log("[GoTo Client] Integration disconnected");
}
