/**
 * Email Webhook Handler
 * POST /api/email/webhook
 *
 * Receives forwarded emails from Resend (hmcgaw@shwunde745.resend.app)
 * and creates potential tasks for users based on AI analysis.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { analyzeEmailForTask } from '@/lib/ai/email-analyzer';
import logger from '@/lib/logger';
import { z } from 'zod';

// ============================================================================
// RESEND WEBHOOK TYPES
// ============================================================================

// Resend inbound webhook payload structure
const ResendWebhookSchema = z.object({
  type: z.literal('email.received'),
  created_at: z.string(),
  data: z.object({
    from: z.string(),
    to: z.array(z.string()),
    subject: z.string(),
    html: z.string().optional(),
    text: z.string().optional(),
    reply_to: z.string().optional(),
    headers: z.record(z.string(), z.string()).optional(),
    created_at: z.string(),
    email_id: z.string(),
    message_id: z.string().optional(),
  }),
});

type ResendWebhook = z.infer<typeof ResendWebhookSchema>;
type ResendEmail = ResendWebhook['data'];

// ============================================================================
// POST /api/email/webhook
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify webhook signature (security)
    const signature = request.headers.get('svix-signature');
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

    if (webhookSecret && signature) {
      // TODO: Implement proper Svix signature verification
      // For now, we'll just log that we received a signature
      logger.info('[Email Webhook] Received signed webhook', {
        hasSignature: true,
      });
    } else if (webhookSecret) {
      logger.warn('[Email Webhook] No signature provided but secret configured');
    }

    // Parse request body
    const body = await request.json();

    logger.info('[Email Webhook] Received webhook', {
      type: body.type,
      hasData: !!body.data,
    });

    // Validate webhook payload
    let webhook: ResendWebhook;
    try {
      webhook = ResendWebhookSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error('[Email Webhook] Invalid payload', { error: error.issues });
        return NextResponse.json(
          {
            error: 'Invalid webhook payload',
            details: error.issues.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          },
          { status: 400 }
        );
      }
      throw error;
    }

    // Extract email data from webhook
    const email = webhook.data;

    logger.info('[Email Webhook] Email data extracted', {
      from: email.from,
      to: email.to,
      subject: email.subject,
    });

    // Use the forwarder's email address directly (who sent it to the system)
    const forwarderEmail = extractEmailAddress(email.from);

    if (!forwarderEmail) {
      logger.warn('[Email Webhook] Could not extract forwarder email', {
        from: email.from,
        subject: email.subject,
      });

      return NextResponse.json(
        { error: 'Could not identify forwarder email' },
        { status: 400 }
      );
    }

    logger.info('[Email Webhook] Processing email from forwarder', {
      forwarderEmail,
      from: email.from,
      subject: email.subject,
    });

    // Find user by forwarder's email
    const supabase = await createClient();
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name, is_active')
      .eq('email', forwarderEmail)
      .eq('is_active', true)
      .single();

    if (userError || !user) {
      logger.warn('[Email Webhook] User not found - creating unassigned records', {
        forwarderEmail,
        error: userError,
      });

      // Create unassigned email_message and potential_task (visible to all users)
      await createUnassignedEmailAndTask(supabase, email, forwarderEmail);

      return NextResponse.json({
        success: true,
        message: 'Email received from unknown sender - created unassigned records for all users',
      });
    }

    logger.info('[Email Webhook] User found', {
      userId: user.id,
      userEmail: user.email,
      userName: user.full_name,
    });

    // Store email message (optional - for reference)
    const emailBody = email.text || stripHtml(email.html || '');
    const receivedAt = new Date(email.created_at);

    // Warn if email body is missing
    if (!emailBody || emailBody.trim().length === 0) {
      logger.warn('[Email Webhook] Email body is missing from webhook payload', {
        from: forwarderEmail,
        subject: email.subject,
        hasText: !!email.text,
        hasHtml: !!email.html,
        note: 'Enable "Include Email Content" in Resend webhook settings to receive full email body',
      });
    }

    // Analyze email with AI
    const analysis = await analyzeEmailForTask({
      from: forwarderEmail,
      subject: email.subject,
      body: emailBody,
      receivedAt,
    });

    if (!analysis.success) {
      logger.error('[Email Webhook] AI analysis failed', {
        userId: user.id,
        error: analysis.error,
      });

      return NextResponse.json(
        { error: 'Failed to analyze email', details: analysis.error },
        { status: 500 }
      );
    }

    // If AI determines no task is needed, just acknowledge receipt
    if (!analysis.shouldCreateTask) {
      logger.info('[Email Webhook] No task needed', {
        userId: user.id,
        reasoning: analysis.suggestion?.reasoning,
      });

      return NextResponse.json({
        success: true,
        message: 'Email received - no task needed',
        reasoning: analysis.suggestion?.reasoning,
      });
    }

    // Create email_message record first (for Inbound Communications)
    const { data: emailMessage, error: emailError } = await supabase
      .from('email_messages')
      .insert({
        user_id: user.id,
        connection_id: null, // Not from OAuth connection
        message_id: email.message_id || email.email_id, // Resend's unique ID
        internet_message_id: email.message_id,
        subject: email.subject,
        from_email: forwarderEmail,
        from_name: user.full_name,
        to_recipients: email.to.map((to) => ({ email: to, name: '' })),
        body_preview: emailBody.substring(0, 500),
        body_html: email.html,
        body_text: email.text,
        received_at: receivedAt.toISOString(),
        sent_at: receivedAt.toISOString(),
        importance: 'normal',
        is_read: false,
        is_flagged: false,
        is_draft: false,
        has_attachments: false,
        attachment_count: 0,
        folder: 'inbox',
      })
      .select('id')
      .single();

    if (emailError) {
      logger.error('[Email Webhook] Failed to create email message', {
        userId: user.id,
        error: emailError,
      });

      return NextResponse.json(
        { error: 'Failed to create email message' },
        { status: 500 }
      );
    }

    // Create potential task linked to email message
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expire in 7 days

    const { data: potentialTask, error: taskError } = await supabase
      .from('potential_tasks')
      .insert({
        user_id: user.id,
        email_message_id: emailMessage.id, // Link to email message
        source_email_from: forwarderEmail,
        source_email_subject: email.subject,
        source_email_body: emailBody,
        source_email_received_at: receivedAt.toISOString(),
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
        status: 'pending',
      })
      .select('id')
      .single();

    if (taskError) {
      logger.error('[Email Webhook] Failed to create potential task', {
        userId: user.id,
        error: taskError,
      });

      return NextResponse.json(
        { error: 'Failed to create potential task' },
        { status: 500 }
      );
    }

    const duration = Date.now() - startTime;

    logger.info('[Email Webhook] Email message and potential task created', {
      userId: user.id,
      emailMessageId: emailMessage.id,
      potentialTaskId: potentialTask.id,
      confidence: analysis.suggestion!.confidence,
      duration,
    });

    return NextResponse.json({
      success: true,
      message: 'Email and potential task created successfully',
      emailMessageId: emailMessage.id,
      potentialTaskId: potentialTask.id,
      confidence: analysis.suggestion!.confidence,
      duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('[Email Webhook] Webhook processing failed', {
      error,
      duration,
    });

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract original sender from forwarded email
 * Checks Reply-To header first, then From header
 */
function extractOriginalSender(email: ResendEmail): string | null {
  // First check reply_to header (most reliable for forwarded emails)
  if (email.reply_to) {
    const extracted = extractEmailAddress(email.reply_to);
    if (extracted) return extracted;
  }

  // Check headers for original sender
  if (email.headers) {
    // Check X-Forwarded-For header (some email clients add this)
    const forwardedFor = email.headers['x-forwarded-for'];
    if (forwardedFor) {
      const extracted = extractEmailAddress(forwardedFor);
      if (extracted) return extracted;
    }

    // Check Reply-To header in headers object
    const replyTo = email.headers['reply-to'];
    if (replyTo) {
      const extracted = extractEmailAddress(replyTo);
      if (extracted) return extracted;
    }
  }

  // Fall back to from address (might be the forwarder, not original sender)
  return extractEmailAddress(email.from);
}

/**
 * Extract email address from string like "John Doe <john@example.com>"
 */
function extractEmailAddress(input: string): string | null {
  const match = input.match(/<([^>]+)>/) || input.match(/([^\s]+@[^\s]+)/);
  return match ? match[1].trim().toLowerCase() : null;
}

/**
 * Strip HTML tags and return plain text
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Create unassigned email and task for unknown sender
 * Creates ONE record with user_id = NULL that all users can see
 */
async function createUnassignedEmailAndTask(
  supabase: any,
  email: ResendEmail,
  senderEmail: string
): Promise<void> {
  const emailBody = email.text || stripHtml(email.html || '');
  const receivedAt = new Date(email.created_at);

  // Create unassigned email_message (user_id = NULL means visible to all)
  const { data: emailMessage, error: emailError } = await supabase
    .from('email_messages')
    .insert({
      user_id: null, // NULL = unassigned, visible to all users
      connection_id: null,
      message_id: email.message_id || email.email_id,
      internet_message_id: email.message_id,
      subject: email.subject,
      from_email: senderEmail,
      from_name: senderEmail,
      to_recipients: email.to.map((to: string) => ({ email: to, name: '' })),
      body_preview: emailBody.substring(0, 500),
      body_html: email.html,
      body_text: email.text,
      received_at: receivedAt.toISOString(),
      sent_at: receivedAt.toISOString(),
      importance: 'high', // Mark unassigned as high importance
      is_read: false,
      is_flagged: true, // Flag unassigned emails
      is_draft: false,
      has_attachments: false,
      attachment_count: 0,
      folder: 'inbox',
    })
    .select('id')
    .single();

  if (emailError) {
    logger.error('[Email Webhook] Failed to create unassigned email message', {
      senderEmail,
      error: emailError,
    });
    return;
  }

  // Create unassigned potential task
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await supabase.from('potential_tasks').insert({
    user_id: null, // NULL = unassigned, visible to all users
    email_message_id: emailMessage.id,
    source_email_from: senderEmail,
    source_email_subject: email.subject,
    source_email_body: emailBody,
    source_email_received_at: receivedAt.toISOString(),
    suggested_title: `⚠️ Unassigned: ${email.subject}`,
    suggested_description: `Email from unknown sender: ${senderEmail}\n\n${emailBody}`,
    suggested_priority: 'high',
    ai_confidence: 0, // No AI analysis for unassigned
    ai_reasoning: 'Email from non-user address - needs assignment',
    expires_at: expiresAt.toISOString(),
    status: 'pending',
  });

  logger.info('[Email Webhook] Created unassigned email and task for all users', {
    senderEmail,
    emailMessageId: emailMessage.id,
  });
}

// ============================================================================
// OPTIONS (CORS preflight)
// ============================================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
