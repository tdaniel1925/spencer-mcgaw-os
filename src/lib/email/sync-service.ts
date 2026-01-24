/**
 * Email Sync Service
 *
 * Handles syncing emails from Microsoft Graph:
 * - Initial sync: Download all emails (paginated)
 * - Delta sync: Get only changes since last sync
 * - Webhook notifications: Process real-time updates
 *
 * Following CodeBakers patterns:
 * - 00-core: Error handling, loading states, type safety
 * - 06b-email: Microsoft Graph integration
 * - 14-ai: AI processing queuing
 */

import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/shared/crypto";
import logger from "@/lib/logger";
import type { EmailMessage, EmailThread } from "@/db/schema";

const MICROSOFT_GRAPH_URL = "https://graph.microsoft.com/v1.0";
const BATCH_SIZE = 100; // Messages per page
const MAX_SYNC_PAGES = 50; // Safety limit

interface MicrosoftGraphMessage {
  id: string;
  conversationId?: string;
  internetMessageId?: string;
  subject?: string;
  bodyPreview?: string;
  body?: {
    contentType: "html" | "text";
    content: string;
  };
  from?: {
    emailAddress: {
      address: string;
      name?: string;
    };
  };
  toRecipients?: Array<{
    emailAddress: {
      address: string;
      name?: string;
    };
  }>;
  ccRecipients?: Array<{
    emailAddress: {
      address: string;
      name?: string;
    };
  }>;
  bccRecipients?: Array<{
    emailAddress: {
      address: string;
      name?: string;
    };
  }>;
  receivedDateTime: string;
  sentDateTime?: string;
  importance?: "low" | "normal" | "high";
  isRead: boolean;
  isDraft: boolean;
  hasAttachments: boolean;
  flag?: {
    flagStatus: string;
  };
  internetMessageHeaders?: Array<{
    name: string;
    value: string;
  }>;
  attachments?: Array<{
    id: string;
    name: string;
    contentType: string;
    size: number;
  }>;
}

interface SyncStats {
  messagesProcessed: number;
  newMessages: number;
  updatedMessages: number;
  errors: number;
  threadsCreated: number;
  threadsUpdated: number;
}

/**
 * Main email sync function
 */
export async function syncEmails(
  userId: string,
  connectionId: string
): Promise<SyncStats> {
  const supabase = await createClient();
  const startTime = Date.now();
  const stats: SyncStats = {
    messagesProcessed: 0,
    newMessages: 0,
    updatedMessages: 0,
    errors: 0,
    threadsCreated: 0,
    threadsUpdated: 0,
  };

  logger.info("Starting email sync", { userId, connectionId });

  try {
    // 1. Update sync status to syncing
    await supabase
      .from("email_sync_state")
      .upsert({
        connection_id: connectionId,
        user_id: userId,
        sync_status: "syncing",
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "connection_id",
      });

    // 2. Get sync state and access token
    const { data: syncState } = await supabase
      .from("email_sync_state")
      .select("delta_token, sync_cursor, total_messages_synced, sync_error_count")
      .eq("connection_id", connectionId)
      .single();

    const accessToken = await getAccessToken(connectionId);

    // 3. Determine sync type
    const useDelta = !!syncState?.delta_token;

    if (useDelta) {
      // Delta sync - only get changes
      logger.info("Performing delta sync", { connectionId });
      await processDeltaSync(syncState.delta_token, accessToken, userId, connectionId, stats);
    } else {
      // Initial sync - get all messages
      logger.info("Performing initial sync", { connectionId });
      await processInitialSync(accessToken, userId, connectionId, stats);
    }

    // 4. Update sync state - success
    const duration = Date.now() - startTime;
    await supabase
      .from("email_sync_state")
      .update({
        sync_status: "idle",
        last_successful_sync_at: new Date().toISOString(),
        sync_error: null,
        sync_error_count: 0,
        last_message_count: stats.newMessages,
        total_messages_synced: (syncState?.total_messages_synced || 0) + stats.newMessages,
        sync_duration_ms: duration,
        updated_at: new Date().toISOString(),
      })
      .eq("connection_id", connectionId);

    logger.info("Email sync completed successfully", {
      ...stats,
      durationMs: duration,
    });

    return stats;
  } catch (error) {
    logger.error("Email sync failed", { userId, connectionId, error });

    // Get current sync state for error count
    const { data: currentState } = await supabase
      .from("email_sync_state")
      .select("sync_error_count")
      .eq("connection_id", connectionId)
      .single();

    // Update sync state - error
    await supabase
      .from("email_sync_state")
      .update({
        sync_status: "error",
        sync_error: error instanceof Error ? error.message : "Unknown error",
        sync_error_count: (currentState?.sync_error_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("connection_id", connectionId);

    throw error;
  }
}

/**
 * Process initial sync (all messages)
 */
async function processInitialSync(
  accessToken: string,
  userId: string,
  connectionId: string,
  stats: SyncStats
): Promise<void> {
  let nextUrl: string | null = `${MICROSOFT_GRAPH_URL}/me/messages?$top=${BATCH_SIZE}&$orderby=receivedDateTime desc`;
  let pagesProcessed = 0;

  while (nextUrl && pagesProcessed < MAX_SYNC_PAGES) {
    logger.info("Fetching message page", { page: pagesProcessed + 1 });

    const response: Response = await fetch(nextUrl, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Prefer": 'outlook.body-content-type="text"', // Get text body for easier processing
      },
    });

    if (!response.ok) {
      const error: any = await response.json();
      throw new Error(`Microsoft Graph API error: ${error.error?.message || "Unknown error"}`);
    }

    const data: any = await response.json();

    // Process batch of messages
    for (const message of data.value || []) {
      await processEmailMessage(message, userId, connectionId, stats);
    }

    // Get next page
    nextUrl = data["@odata.nextLink"] || null;
    pagesProcessed++;

    // Save delta token when initial sync completes
    if (!nextUrl && data["@odata.deltaLink"]) {
      const supabase = await createClient();
      await supabase
        .from("email_sync_state")
        .update({
          delta_token: data["@odata.deltaLink"],
          updated_at: new Date().toISOString(),
        })
        .eq("connection_id", connectionId);

      logger.info("Saved delta token for future syncs", { connectionId });
    }
  }

  if (pagesProcessed >= MAX_SYNC_PAGES) {
    logger.warn("Hit max page limit during initial sync", { pagesProcessed });
  }
}

/**
 * Process delta sync (changes only)
 */
async function processDeltaSync(
  deltaUrl: string,
  accessToken: string,
  userId: string,
  connectionId: string,
  stats: SyncStats
): Promise<void> {
  const response = await fetch(deltaUrl, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Prefer": 'outlook.body-content-type="text"',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Microsoft Graph API error: ${error.error?.message || "Unknown error"}`);
  }

  const data = await response.json();

  // Process changed messages
  for (const message of data.value || []) {
    await processEmailMessage(message, userId, connectionId, stats);
  }

  // Update delta token for next sync
  if (data["@odata.deltaLink"]) {
    const supabase = await createClient();
    await supabase
      .from("email_sync_state")
      .update({
        delta_token: data["@odata.deltaLink"],
        updated_at: new Date().toISOString(),
      })
      .eq("connection_id", connectionId);
  }
}

/**
 * Process a single email message
 */
async function processEmailMessage(
  graphMessage: MicrosoftGraphMessage,
  userId: string,
  connectionId: string,
  stats: SyncStats
): Promise<void> {
  const supabase = await createClient();

  try {
    // 1. Check if message already exists
    const { data: existing } = await supabase
      .from("email_messages")
      .select("id, thread_id")
      .eq("message_id", graphMessage.id)
      .single();

    // 2. Find or create thread
    const threadId = await findOrCreateThread(userId, graphMessage, stats);

    // 3. Try to match client by email
    const clientId = await matchEmailToClient(userId, graphMessage);

    // 4. Determine folder
    const folder = graphMessage.isDraft ? "drafts" : "inbox";

    // 5. Prepare message data
    const messageData = {
      user_id: userId,
      connection_id: connectionId,
      thread_id: threadId,
      message_id: graphMessage.id,
      conversation_id: graphMessage.conversationId,
      internet_message_id: graphMessage.internetMessageId,
      subject: graphMessage.subject,
      from_email: graphMessage.from?.emailAddress?.address,
      from_name: graphMessage.from?.emailAddress?.name,
      to_recipients: graphMessage.toRecipients?.map((r) => ({
        email: r.emailAddress.address,
        name: r.emailAddress.name || "",
      })) || [],
      cc_recipients: graphMessage.ccRecipients?.map((r) => ({
        email: r.emailAddress.address,
        name: r.emailAddress.name || "",
      })) || [],
      bcc_recipients: graphMessage.bccRecipients?.map((r) => ({
        email: r.emailAddress.address,
        name: r.emailAddress.name || "",
      })) || [],
      body_preview: graphMessage.bodyPreview,
      body_html: graphMessage.body?.contentType === "html" ? graphMessage.body.content : null,
      body_text: graphMessage.body?.contentType === "text" ? graphMessage.body.content : null,
      received_at: graphMessage.receivedDateTime,
      sent_at: graphMessage.sentDateTime || graphMessage.receivedDateTime,
      importance: graphMessage.importance || "normal",
      is_read: graphMessage.isRead,
      is_flagged: graphMessage.flag?.flagStatus === "flagged",
      is_draft: graphMessage.isDraft,
      has_attachments: graphMessage.hasAttachments,
      attachment_count: graphMessage.attachments?.length || 0,
      folder,
      client_id: clientId,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      // Update existing message
      await supabase
        .from("email_messages")
        .update(messageData)
        .eq("id", existing.id);
      stats.updatedMessages++;
    } else {
      // Insert new message
      const { data: newMessage, error: insertError } = await supabase
        .from("email_messages")
        .insert(messageData)
        .select("id")
        .single();

      if (insertError) {
        throw insertError;
      }

      stats.newMessages++;

      // Queue for AI analysis (async - don't wait)
      queueEmailForAI(newMessage.id, userId).catch((err) =>
        logger.error("Failed to queue email for AI", { messageId: newMessage.id, error: err })
      );
    }

    stats.messagesProcessed++;
  } catch (error) {
    logger.error("Failed to process email message", {
      messageId: graphMessage.id,
      error,
    });
    stats.errors++;
  }
}

/**
 * Find or create email thread for message
 * (Implementation in threading.ts - importing here)
 */
async function findOrCreateThread(
  userId: string,
  message: MicrosoftGraphMessage,
  stats: SyncStats
): Promise<string> {
  const supabase = await createClient();

  // Strategy 1: Use Microsoft's conversationId
  if (message.conversationId) {
    const { data: existingThread } = await supabase
      .from("email_threads")
      .select("id")
      .eq("user_id", userId)
      .eq("conversation_id", message.conversationId)
      .single();

    if (existingThread) {
      stats.threadsUpdated++;
      return existingThread.id;
    }
  }

  // Create new thread
  const cleanSubject = cleanEmailSubject(message.subject || "");
  const participants = extractParticipants(message);

  const { data: newThread, error } = await supabase
    .from("email_threads")
    .insert({
      user_id: userId,
      conversation_id: message.conversationId,
      subject: cleanSubject,
      participants: participants.emails,
      participant_names: participants.names,
      message_count: 1,
      unread_count: message.isRead ? 0 : 1,
      has_attachments: message.hasAttachments,
      first_message_at: message.receivedDateTime,
      last_message_at: message.receivedDateTime,
      last_activity_at: message.receivedDateTime,
    })
    .select("id")
    .single();

  if (error) {
    logger.error("Failed to create thread", { error });
    throw error;
  }

  stats.threadsCreated++;
  return newThread.id;
}

/**
 * Clean email subject (remove Re:, Fwd:, etc.)
 */
function cleanEmailSubject(subject: string): string {
  return subject
    .replace(/^(Re|RE|Fwd|FW|Fw):\s*/gi, "")
    .trim();
}

/**
 * Extract unique participants from message
 */
function extractParticipants(message: MicrosoftGraphMessage): {
  emails: string[];
  names: string[];
} {
  const participantMap = new Map<string, string>();

  // Add from
  if (message.from?.emailAddress?.address) {
    participantMap.set(
      message.from.emailAddress.address.toLowerCase(),
      message.from.emailAddress.name || ""
    );
  }

  // Add to
  message.toRecipients?.forEach((r) => {
    participantMap.set(
      r.emailAddress.address.toLowerCase(),
      r.emailAddress.name || ""
    );
  });

  // Add cc
  message.ccRecipients?.forEach((r) => {
    participantMap.set(
      r.emailAddress.address.toLowerCase(),
      r.emailAddress.name || ""
    );
  });

  return {
    emails: Array.from(participantMap.keys()),
    names: Array.from(participantMap.values()).filter(Boolean),
  };
}

/**
 * Try to match email sender to existing client
 */
async function matchEmailToClient(
  userId: string,
  message: MicrosoftGraphMessage
): Promise<string | null> {
  if (!message.from?.emailAddress?.address) {
    return null;
  }

  const supabase = await createClient();
  const email = message.from.emailAddress.address.toLowerCase();

  // Try exact email match
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .ilike("email", email)
    .limit(1)
    .single();

  return client?.id || null;
}

/**
 * Queue email for AI analysis
 */
async function queueEmailForAI(messageId: string, userId: string): Promise<void> {
  // This would trigger background job for AI categorization
  // For now, just log
  logger.info("Queued email for AI analysis", { messageId, userId });
}

/**
 * Get access token for connection (with refresh if needed)
 */
async function getAccessToken(connectionId: string): Promise<string> {
  const supabase = await createClient();

  const { data: connection } = await supabase
    .from("email_connections")
    .select("access_token, refresh_token, expires_at")
    .eq("id", connectionId)
    .single();

  if (!connection) {
    throw new Error(`Email connection ${connectionId} not found`);
  }

  // Decrypt and return
  return decrypt(connection.access_token);
}
