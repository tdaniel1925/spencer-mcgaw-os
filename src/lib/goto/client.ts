/**
 * GoTo Connect API Client
 *
 * Handles authentication, API calls, and subscription management
 * for GoTo Connect phone system integration.
 *
 * API Documentation: https://developer.goto.com/GoToConnect
 */

const GOTO_API_BASE = "https://api.goto.com";
const GOTO_AUTH_BASE = "https://authentication.logmeininc.com";

// OAuth token storage (in production, store in database)
interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  accountKey: string;
}

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
    "call-events.v1.notifications.manage",
    "call-events.v1.events.read",
    "cr.v1.read",
    "recording.v1.read",
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

  return tokenCache;
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(): Promise<TokenData> {
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
    throw new Error(`Failed to refresh token: ${error}`);
  }

  const data = await response.json();

  tokenCache = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || tokenCache.refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
    accountKey: tokenCache.accountKey,
  };

  return tokenCache;
}

/**
 * Get valid access token (refresh if needed)
 */
export async function getAccessToken(): Promise<string> {
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
 * Check if authenticated
 */
export function isAuthenticated(): boolean {
  return tokenCache !== null && tokenCache.expiresAt > Date.now();
}

/**
 * Get account key
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
 */
export async function getRecordingUrl(recordingId: string): Promise<string> {
  const response = await gotoApiRequest<{ url: string }>(
    `/recording/v1/recordings/${recordingId}/content`
  );
  return response.url;
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

  console.log("[GoTo Setup] Setup complete!");

  return {
    channelId: channel.channelId,
    webhookUrl,
    subscriptions: ["call-events", "call-reports"],
  };
}
