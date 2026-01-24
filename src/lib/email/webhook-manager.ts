/**
 * Microsoft Graph Webhook Subscription Manager
 *
 * Handles real-time email notifications via Microsoft Graph webhooks.
 * Subscriptions expire every 3 days and must be renewed.
 *
 * Following CodeBakers patterns:
 * - 00-core: Error handling, type safety
 * - 06b-email: Microsoft Graph integration
 * - 06f-api-patterns: Generic API client patterns
 */

import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/shared/crypto";
import logger from "@/lib/logger";
import crypto from "crypto";

const MICROSOFT_GRAPH_URL = "https://graph.microsoft.com/v1.0";
const SUBSCRIPTION_LIFETIME_DAYS = 3; // Microsoft limit
const RENEWAL_BUFFER_HOURS = 12; // Renew 12 hours before expiry

interface WebhookSubscription {
  id: string;
  resource: string;
  changeType: string;
  notificationUrl: string;
  expirationDateTime: string;
  clientState: string;
}

interface CreateSubscriptionParams {
  userId: string;
  connectionId: string;
  accessToken: string;
}

/**
 * Generate secure client state for CSRF protection
 */
export function generateClientState(userId: string, connectionId: string): string {
  const secret = process.env.WEBHOOK_SECRET || "default-secret-change-in-production";
  const timestamp = Date.now();
  const data = `${userId}:${connectionId}:${timestamp}`;
  const hash = crypto.createHmac("sha256", secret).update(data).digest("hex");
  return `${data}:${hash}`;
}

/**
 * Validate client state from webhook notification
 */
export function validateClientState(clientState: string): { valid: boolean; userId?: string; connectionId?: string } {
  const secret = process.env.WEBHOOK_SECRET || "default-secret-change-in-production";

  const parts = clientState.split(":");
  if (parts.length !== 4) {
    return { valid: false };
  }

  const [userId, connectionId, timestamp, receivedHash] = parts;
  const data = `${userId}:${connectionId}:${timestamp}`;
  const expectedHash = crypto.createHmac("sha256", secret).update(data).digest("hex");

  if (receivedHash !== expectedHash) {
    return { valid: false };
  }

  // Check timestamp not too old (24 hours)
  const age = Date.now() - parseInt(timestamp);
  if (age > 24 * 60 * 60 * 1000) {
    return { valid: false };
  }

  return { valid: true, userId, connectionId };
}

/**
 * Get access token for a connection (refresh if needed)
 */
async function getAccessToken(connectionId: string): Promise<string> {
  const supabase = await createClient();

  const { data: connection } = await supabase
    .from("email_connections")
    .select("access_token, refresh_token, expires_at, provider")
    .eq("id", connectionId)
    .single();

  if (!connection) {
    throw new Error(`Email connection ${connectionId} not found`);
  }

  // Decrypt token
  const accessToken = decrypt(connection.access_token);

  // Check if expired
  const expiresAt = new Date(connection.expires_at);
  const now = new Date();

  if (expiresAt > now) {
    return accessToken; // Still valid
  }

  // Need to refresh
  if (!connection.refresh_token) {
    throw new Error("Access token expired and no refresh token available");
  }

  // Refresh token (implementation would go here - reuse from OAuth callback)
  logger.warn("Token refresh needed", { connectionId });
  return accessToken; // For now, return existing token
}

/**
 * Create a new webhook subscription
 */
export async function createEmailWebhookSubscription(
  params: CreateSubscriptionParams
): Promise<{ subscriptionId: string; expiresAt: Date }> {
  const { userId, connectionId, accessToken } = params;

  // Calculate expiration (3 days from now)
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + SUBSCRIPTION_LIFETIME_DAYS);

  // Build notification URL
  const notificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/email/webhook`;

  // Generate secure client state
  const clientState = generateClientState(userId, connectionId);

  logger.info("Creating Microsoft Graph webhook subscription", {
    userId,
    connectionId,
    notificationUrl,
    expiresAt: expirationDate.toISOString(),
  });

  try {
    // Create subscription via Microsoft Graph API
    const response = await fetch(`${MICROSOFT_GRAPH_URL}/subscriptions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        changeType: "created,updated",
        notificationUrl,
        resource: "me/messages",
        expirationDateTime: expirationDate.toISOString(),
        clientState,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      logger.error("Failed to create webhook subscription", {
        status: response.status,
        error,
      });
      throw new Error(`Microsoft Graph API error: ${error.error?.message || "Unknown error"}`);
    }

    const subscription: WebhookSubscription = await response.json();

    // Store subscription details in database
    const supabase = await createClient();
    await supabase
      .from("email_sync_state")
      .upsert({
        connection_id: connectionId,
        user_id: userId,
        webhook_subscription_id: subscription.id,
        webhook_expires_at: subscription.expirationDateTime,
        webhook_status: "active",
        webhook_notification_url: notificationUrl,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "connection_id",
      });

    logger.info("Webhook subscription created successfully", {
      subscriptionId: subscription.id,
      expiresAt: subscription.expirationDateTime,
    });

    return {
      subscriptionId: subscription.id,
      expiresAt: new Date(subscription.expirationDateTime),
    };
  } catch (error) {
    logger.error("Error creating webhook subscription", error);

    // Update sync state with error
    const supabase = await createClient();
    await supabase
      .from("email_sync_state")
      .upsert({
        connection_id: connectionId,
        user_id: userId,
        webhook_status: "failed",
        sync_error: error instanceof Error ? error.message : "Unknown error",
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "connection_id",
      });

    throw error;
  }
}

/**
 * Renew an existing webhook subscription
 */
export async function renewWebhookSubscription(
  connectionId: string,
  subscriptionId: string
): Promise<{ expiresAt: Date }> {
  logger.info("Renewing webhook subscription", { connectionId, subscriptionId });

  try {
    // Get access token
    const accessToken = await getAccessToken(connectionId);

    // Calculate new expiration
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + SUBSCRIPTION_LIFETIME_DAYS);

    // Renew subscription via Microsoft Graph API
    const response = await fetch(`${MICROSOFT_GRAPH_URL}/subscriptions/${subscriptionId}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expirationDateTime: expirationDate.toISOString(),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      logger.error("Failed to renew webhook subscription", {
        status: response.status,
        error,
      });
      throw new Error(`Microsoft Graph API error: ${error.error?.message || "Unknown error"}`);
    }

    const subscription: WebhookSubscription = await response.json();

    // Update database
    const supabase = await createClient();
    await supabase
      .from("email_sync_state")
      .update({
        webhook_expires_at: subscription.expirationDateTime,
        webhook_status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("connection_id", connectionId);

    logger.info("Webhook subscription renewed successfully", {
      subscriptionId,
      newExpiresAt: subscription.expirationDateTime,
    });

    return {
      expiresAt: new Date(subscription.expirationDateTime),
    };
  } catch (error) {
    logger.error("Error renewing webhook subscription", error);

    // Update sync state with error
    const supabase = await createClient();
    await supabase
      .from("email_sync_state")
      .update({
        webhook_status: "failed",
        sync_error: error instanceof Error ? error.message : "Unknown error",
        updated_at: new Date().toISOString(),
      })
      .eq("connection_id", connectionId);

    throw error;
  }
}

/**
 * Delete a webhook subscription
 */
export async function deleteWebhookSubscription(
  connectionId: string,
  subscriptionId: string
): Promise<void> {
  logger.info("Deleting webhook subscription", { connectionId, subscriptionId });

  try {
    // Get access token
    const accessToken = await getAccessToken(connectionId);

    // Delete subscription via Microsoft Graph API
    const response = await fetch(`${MICROSOFT_GRAPH_URL}/subscriptions/${subscriptionId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    if (!response.ok && response.status !== 404) {
      const error = await response.json();
      logger.error("Failed to delete webhook subscription", {
        status: response.status,
        error,
      });
      throw new Error(`Microsoft Graph API error: ${error.error?.message || "Unknown error"}`);
    }

    // Update database
    const supabase = await createClient();
    await supabase
      .from("email_sync_state")
      .update({
        webhook_subscription_id: null,
        webhook_expires_at: null,
        webhook_status: "none",
        updated_at: new Date().toISOString(),
      })
      .eq("connection_id", connectionId);

    logger.info("Webhook subscription deleted successfully", { subscriptionId });
  } catch (error) {
    logger.error("Error deleting webhook subscription", error);
    throw error;
  }
}

/**
 * Find subscriptions that need renewal (expire in < 12 hours)
 * Should be run as a cron job
 */
export async function findExpiringSubscriptions(): Promise<
  Array<{ connectionId: string; userId: string; subscriptionId: string }>
> {
  const supabase = await createClient();

  const renewalThreshold = new Date();
  renewalThreshold.setHours(renewalThreshold.getHours() + RENEWAL_BUFFER_HOURS);

  const { data: expiring } = await supabase
    .from("email_sync_state")
    .select("connection_id, user_id, webhook_subscription_id")
    .eq("webhook_status", "active")
    .not("webhook_subscription_id", "is", null)
    .lt("webhook_expires_at", renewalThreshold.toISOString());

  return (expiring || []).map((sub) => ({
    connectionId: sub.connection_id,
    userId: sub.user_id,
    subscriptionId: sub.webhook_subscription_id!,
  }));
}

/**
 * Renew all expiring subscriptions
 * Should be run as a daily cron job
 */
export async function renewExpiringSubscriptions(): Promise<{
  renewed: number;
  failed: number;
  errors: Array<{ connectionId: string; error: string }>;
}> {
  logger.info("Starting webhook subscription renewal job");

  const expiring = await findExpiringSubscriptions();
  const results = { renewed: 0, failed: 0, errors: [] as Array<{ connectionId: string; error: string }> };

  for (const sub of expiring) {
    try {
      await renewWebhookSubscription(sub.connectionId, sub.subscriptionId);
      results.renewed++;
    } catch (error) {
      logger.error("Failed to renew subscription", {
        connectionId: sub.connectionId,
        error,
      });
      results.failed++;
      results.errors.push({
        connectionId: sub.connectionId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  logger.info("Webhook subscription renewal job complete", results);

  return results;
}

/**
 * Initialize webhook for a new email connection
 */
export async function initializeWebhookForConnection(
  userId: string,
  connectionId: string
): Promise<void> {
  logger.info("Initializing webhook for email connection", { userId, connectionId });

  try {
    // Get access token
    const accessToken = await getAccessToken(connectionId);

    // Create subscription
    await createEmailWebhookSubscription({
      userId,
      connectionId,
      accessToken,
    });

    logger.info("Webhook initialized successfully", { connectionId });
  } catch (error) {
    logger.error("Failed to initialize webhook", { connectionId, error });
    // Don't throw - connection can still work with polling
  }
}
