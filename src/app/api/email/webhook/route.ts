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

    // Extract original sender email (from forwarded email)
    const originalFrom = extractOriginalSender(email);

    if (!originalFrom) {
      logger.warn('[Email Webhook] Could not extract original sender', {
        from: email.from,
        subject: email.subject,
      });

      return NextResponse.json(
        { error: 'Could not identify original sender' },
        { status: 400 }
      );
    }

    logger.info('[Email Webhook] Extracted original sender', {
      originalFrom,
      forwardedFrom: email.from,
    });

    // Find user by email
    const supabase = await createClient();
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name, is_active')
      .eq('email', originalFrom)
      .eq('is_active', true)
      .single();

    if (userError || !user) {
      logger.warn('[Email Webhook] User not found', {
        originalFrom,
        error: userError,
      });

      // Create potential task as "unassigned" for admin review
      await createUnassignedPotentialTask(supabase, email, originalFrom);

      return NextResponse.json({
        success: true,
        message: 'Email received but user not found - created unassigned task',
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

    // Analyze email with AI
    const analysis = await analyzeEmailForTask({
      from: originalFrom,
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

    // Create potential task
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expire in 7 days

    const { data: potentialTask, error: taskError } = await supabase
      .from('potential_tasks')
      .insert({
        user_id: user.id,
        source_email_from: originalFrom,
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

    logger.info('[Email Webhook] Potential task created', {
      userId: user.id,
      potentialTaskId: potentialTask.id,
      confidence: analysis.suggestion!.confidence,
      duration,
    });

    return NextResponse.json({
      success: true,
      message: 'Potential task created successfully',
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
 * Create potential task for unassigned/unknown sender
 */
async function createUnassignedPotentialTask(
  supabase: any,
  email: ResendEmail,
  originalFrom: string
): Promise<void> {
  const emailBody = email.text || stripHtml(email.html || '');
  const receivedAt = email.received_at ? new Date(email.received_at) : new Date();

  // Get first admin user to assign to
  const { data: adminUser } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'admin')
    .eq('is_active', true)
    .limit(1)
    .single();

  if (!adminUser) {
    logger.error('[Email Webhook] No admin user found for unassigned task');
    return;
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await supabase.from('potential_tasks').insert({
    user_id: adminUser.id, // Assign to admin
    source_email_from: originalFrom,
    source_email_subject: email.subject,
    source_email_body: emailBody,
    source_email_received_at: receivedAt.toISOString(),
    suggested_title: `Unassigned: ${email.subject}`,
    suggested_description: `Email from unknown sender: ${originalFrom}\n\n${emailBody}`,
    suggested_priority: 'medium',
    ai_confidence: 0, // No AI analysis for unassigned
    ai_reasoning: 'User not found - assigned to admin for review',
    expires_at: expiresAt.toISOString(),
    status: 'pending',
  });

  logger.info('[Email Webhook] Created unassigned task for admin', {
    originalFrom,
    adminUserId: adminUser.id,
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
