/**
 * Fastmail IMAP Email Sync
 *
 * Fetches emails from Fastmail inbox via IMAP and processes them
 * exactly like the Resend webhook (creates email_messages and potential_tasks)
 */

import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { analyzeEmailForTask } from "@/lib/ai/email-analyzer";
import { decrypt } from "@/lib/shared/crypto";
import logger from "@/lib/logger";
import { simpleParser } from "mailparser";

const imaps = require("imap-simple");

interface FastmailConfig {
  email: string;
  appPassword: string;
  imapHost: string;
  imapPort: number;
}

interface ProcessedEmail {
  messageId: string;
  from: string;
  subject: string;
  textBody: string;
  htmlBody: string | null;
  receivedDate: Date;
  userId: string; // Add userId to track which user's email this is
}

/**
 * Sync emails for ALL users with Fastmail connections
 */
export async function syncAllFastmailAccounts(): Promise<{
  success: boolean;
  totalEmailsProcessed: number;
  usersSynced: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let totalEmailsProcessed = 0;
  let usersSynced = 0;

  try {
    // Use service role client for cron jobs (no user session)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      logger.error("[Fastmail Sync All] Missing Supabase credentials");
      return {
        success: false,
        totalEmailsProcessed: 0,
        usersSynced: 0,
        errors: ["Missing Supabase credentials"],
      };
    }

    const supabase = createServiceClient(supabaseUrl, supabaseServiceKey);

    // Get all active Fastmail connections
    const { data: connections, error: connectionsError } = await supabase
      .from("email_connections")
      .select("id, user_id, email, access_token, metadata")
      .eq("provider", "imap")
      .eq("is_active", true);

    if (connectionsError) {
      logger.error("[Fastmail Sync All] Failed to fetch connections", {
        error: connectionsError,
      });
      return {
        success: false,
        totalEmailsProcessed: 0,
        usersSynced: 0,
        errors: [connectionsError.message],
      };
    }

    if (!connections || connections.length === 0) {
      logger.info("[Fastmail Sync All] No active Fastmail connections found");
      return {
        success: true,
        totalEmailsProcessed: 0,
        usersSynced: 0,
        errors: [],
      };
    }

    logger.info("[Fastmail Sync All] Syncing for users", {
      count: connections.length,
    });

    // Sync each user's account
    for (const connection of connections) {
      try {
        const appPassword = decrypt(connection.access_token);
        const metadata = connection.metadata as any;

        const result = await syncFastmailEmails(
          {
            email: connection.email,
            appPassword,
            imapHost: metadata?.imapHost || "imap.fastmail.com",
            imapPort: metadata?.imapPort || 993,
          },
          connection.user_id
        );

        if (result.success) {
          totalEmailsProcessed += result.emailsProcessed;
          usersSynced++;
          logger.info("[Fastmail Sync All] ✅ Synced user", {
            userId: connection.user_id,
            email: connection.email,
            emailsProcessed: result.emailsProcessed,
          });
        } else {
          errors.push(...result.errors);
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : String(error);
        logger.error("[Fastmail Sync All] Failed to sync user", {
          userId: connection.user_id,
          error,
        });
        errors.push(`User ${connection.email}: ${errorMsg}`);
      }
    }

    logger.info("[Fastmail Sync All] ✅ All users synced", {
      usersSynced,
      totalEmailsProcessed,
      errors: errors.length,
    });

    return {
      success: true,
      totalEmailsProcessed,
      usersSynced,
      errors,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error("[Fastmail Sync All] Sync failed", { error });

    return {
      success: false,
      totalEmailsProcessed,
      usersSynced,
      errors: [errorMsg],
    };
  }
}

/**
 * Sync emails from Fastmail inbox for a specific user
 */
export async function syncFastmailEmails(
  config: FastmailConfig,
  userId: string
): Promise<{
  success: boolean;
  emailsProcessed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let emailsProcessed = 0;

  try {
    logger.info("[Fastmail Sync] Starting email sync", {
      email: config.email,
      host: config.imapHost,
    });

    // Connect to IMAP
    const connection = await imaps.connect({
      imap: {
        user: config.email,
        password: config.appPassword,
        host: config.imapHost,
        port: config.imapPort,
        tls: true,
        tlsOptions: { rejectUnauthorized: true },
        authTimeout: 10000,
      },
    });

    logger.info("[Fastmail Sync] ✅ Connected to IMAP");

    // Open INBOX
    await connection.openBox("INBOX");
    logger.info("[Fastmail Sync] ✅ Opened INBOX");

    // Search for UNSEEN messages (unread emails)
    const searchCriteria = ["UNSEEN"];
    const fetchOptions = {
      bodies: ["HEADER", "TEXT"],
      markSeen: true, // Mark as read after fetching
    };

    const messages = await connection.search(searchCriteria, fetchOptions);

    logger.info("[Fastmail Sync] Found messages", {
      count: messages.length,
    });

    // Process each message
    for (const item of messages) {
      try {
        const email = await parseImapMessage(item, userId);
        logger.info("[Fastmail Sync] Processing email", {
          from: email.from,
          subject: email.subject,
          userId,
        });

        await processEmail(email);
        emailsProcessed++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error("[Fastmail Sync] Failed to process email", { error });
        errors.push(errorMsg);
      }
    }

    // Close connection
    await connection.end();
    logger.info("[Fastmail Sync] ✅ Sync complete", {
      emailsProcessed,
      errors: errors.length,
    });

    return {
      success: true,
      emailsProcessed,
      errors,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error("[Fastmail Sync] Sync failed", { error });
    errors.push(errorMsg);

    return {
      success: false,
      emailsProcessed,
      errors,
    };
  }
}

/**
 * Parse IMAP message into our format using mailparser
 */
async function parseImapMessage(item: any, userId: string): Promise<ProcessedEmail> {
  // Get the raw email source
  const all = item.parts.find((part: any) => part.which === "");
  const rawEmail = all?.body || "";

  // Parse with mailparser
  const parsed = await simpleParser(rawEmail);

  // Extract sender
  const from = parsed.from?.text || "";
  const subject = parsed.subject || "(No Subject)";
  const date = parsed.date || new Date();
  const messageId = parsed.messageId || `fastmail-${Date.now()}`;

  // Get text and HTML body
  const textBody = parsed.text || "";
  const htmlBody = parsed.html || null;

  return {
    messageId,
    from,
    subject,
    textBody,
    htmlBody,
    receivedDate: date,
    userId,
  };
}

/**
 * Process email (same logic as Resend webhook)
 */
async function processEmail(email: ProcessedEmail): Promise<void> {
  const supabase = await createClient();

  // Extract FROM email address (who sent the email)
  const fromEmail = extractEmailAddress(email.from);
  if (!fromEmail) {
    logger.warn("[Fastmail Sync] Could not extract email address", {
      from: email.from,
    });
    return;
  }

  logger.info("[Fastmail Sync] Processing email from", {
    fromEmail,
    userId: email.userId,
  });

  // Store email message
  const { data: emailMessage, error: emailError } = await supabase
    .from("email_messages")
    .upsert(
      {
        user_id: email.userId,
        connection_id: null, // Not from OAuth connection
        message_id: email.messageId,
        internet_message_id: email.messageId,
        subject: email.subject,
        from_email: fromEmail,
        from_name: extractName(email.from),
        to_recipients: [], // TODO: Parse recipients
        body_preview: email.textBody.substring(0, 500),
        body_html: email.htmlBody,
        body_text: email.textBody,
        received_at: email.receivedDate.toISOString(),
        sent_at: email.receivedDate.toISOString(),
        importance: "normal",
        is_read: false,
        is_flagged: false,
        is_draft: false,
        has_attachments: false,
        attachment_count: 0,
        folder: "inbox",
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "message_id",
        ignoreDuplicates: false,
      }
    )
    .select("id")
    .single();

  if (emailError) {
    logger.error("[Fastmail Sync] Failed to create email message", {
      error: emailError,
    });
    throw emailError;
  }

  // Analyze email with AI
  const analysis = await analyzeEmailForTask({
    from: fromEmail,
    subject: email.subject,
    body: email.textBody,
    receivedAt: email.receivedDate,
  });

  if (!analysis.success) {
    logger.error("[Fastmail Sync] AI analysis failed", {
      error: analysis.error,
    });
    return;
  }

  // Create potential task if AI determined one is needed
  if (analysis.shouldCreateTask) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { error: taskError } = await supabase.from("potential_tasks").insert({
      user_id: email.userId,
      email_message_id: emailMessage.id,
      source_email_from: fromEmail,
      source_email_subject: email.subject,
      source_email_body: email.textBody,
      source_email_received_at: email.receivedDate.toISOString(),
      suggested_title: analysis.suggestion!.title,
      suggested_description: analysis.suggestion!.description,
      suggested_priority: analysis.suggestion!.priority,
      suggested_due_date: analysis.suggestion!.dueDate
        ? new Date(analysis.suggestion!.dueDate).toISOString()
        : null,
      ai_confidence: analysis.suggestion!.confidence,
      ai_reasoning: analysis.suggestion!.reasoning,
      ai_extracted_data: analysis.suggestion!.extractedData || {},
      expires_at: expiresAt.toISOString(),
      status: "pending",
    });

    if (taskError) {
      logger.error("[Fastmail Sync] Failed to create potential task", {
        error: taskError,
      });
      throw taskError;
    }

    logger.info("[Fastmail Sync] ✅ Email and task created", {
      emailMessageId: emailMessage.id,
    });
  } else {
    logger.info("[Fastmail Sync] ✅ Email saved (no task needed)", {
      emailMessageId: emailMessage.id,
    });
  }
}

/**
 * Create unassigned email for unknown sender
 */
async function createUnassignedEmail(
  supabase: any,
  email: ProcessedEmail,
  senderEmail: string
): Promise<void> {
  const { data: emailMessage } = await supabase
    .from("email_messages")
    .upsert(
      {
        user_id: null, // Unassigned
        connection_id: null,
        message_id: email.messageId,
        internet_message_id: email.messageId,
        subject: email.subject,
        from_email: senderEmail,
        from_name: senderEmail,
        to_recipients: [],
        body_preview: email.textBody.substring(0, 500),
        body_html: email.htmlBody,
        body_text: email.textBody,
        received_at: email.receivedDate.toISOString(),
        sent_at: email.receivedDate.toISOString(),
        importance: "high", // Mark unassigned as high
        is_read: false,
        is_flagged: true, // Flag unassigned
        is_draft: false,
        has_attachments: false,
        attachment_count: 0,
        folder: "inbox",
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "message_id",
        ignoreDuplicates: false,
      }
    )
    .select("id")
    .single();

  if (!emailMessage) return;

  // Create unassigned potential task
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await supabase.from("potential_tasks").insert({
    user_id: null,
    email_message_id: emailMessage.id,
    source_email_from: senderEmail,
    source_email_subject: email.subject,
    source_email_body: email.textBody,
    source_email_received_at: email.receivedDate.toISOString(),
    suggested_title: `⚠️ Unassigned: ${email.subject}`,
    suggested_description: `Email from unknown sender: ${senderEmail}\n\n${email.textBody}`,
    suggested_priority: "high",
    ai_confidence: 0,
    ai_reasoning: "Email from non-user address - needs assignment",
    expires_at: expiresAt.toISOString(),
    status: "pending",
  });

  logger.info("[Fastmail Sync] ✅ Created unassigned email", {
    senderEmail,
  });
}

/**
 * Extract email address from string
 */
function extractEmailAddress(input: string): string | null {
  const match = input.match(/<([^>]+)>/) || input.match(/([^\s]+@[^\s]+)/);
  return match ? match[1].trim().toLowerCase() : null;
}

/**
 * Extract name from email string like "John Doe <john@example.com>"
 */
function extractName(input: string): string {
  const match = input.match(/^([^<]+)</);
  return match ? match[1].trim() : input;
}
