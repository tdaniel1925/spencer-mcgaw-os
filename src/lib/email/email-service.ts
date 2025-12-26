/**
 * Email Notification Service
 *
 * Sends email notifications for various events using Resend.
 * Respects user notification preferences before sending.
 *
 * SETUP REQUIRED:
 * 1. Install Resend: npm install resend
 * 2. Add RESEND_API_KEY to .env.local
 * 3. Verify your sending domain in Resend dashboard
 */

import { createClient } from "@/lib/supabase/server";
import type { NotificationType } from "@/lib/types/permissions";
import logger from "@/lib/logger";

// Resend client (lazy loaded)
let resendClient: {
  emails: {
    send: (options: {
      from: string;
      to: string;
      subject: string;
      html: string;
      text?: string;
    }) => Promise<{ data?: { id: string }; error?: Error }>;
  };
} | null = null;

async function getResendClient() {
  if (resendClient) return resendClient;

  // Check if API key is configured
  if (!process.env.RESEND_API_KEY) {
    return null;
  }

  try {
    // Dynamic import with type assertion to avoid build-time dependency
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resendModule = await import("resend" as any).catch(() => null);
    if (!resendModule) {
      return null;
    }
    const { Resend } = resendModule;
    resendClient = new Resend(process.env.RESEND_API_KEY);
    return resendClient;
  } catch {
    return null;
  }
}

// Email templates
const EMAIL_FROM = process.env.EMAIL_FROM || "notifications@spencermcgaw.com";
const APP_NAME = "Spencer McGaw Hub";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email using Resend
 */
async function sendEmail(options: EmailOptions): Promise<boolean> {
  const client = await getResendClient();
  if (!client) {
    return false;
  }

  try {
    const { data, error } = await client.emails.send({
      from: EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    if (error) {
      logger.error("[Email] Failed to send", error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error("[Email] Error sending email", error);
    return false;
  }
}

/**
 * Check if user wants email notifications for a type
 */
async function shouldSendEmail(
  userId: string,
  notificationType: NotificationType
): Promise<{ shouldSend: boolean; email: string | null }> {
  const supabase = await createClient();

  // Get user email and preferences
  const { data: user } = await supabase
    .from("user_profiles")
    .select("email")
    .eq("id", userId)
    .single();

  if (!user?.email) {
    return { shouldSend: false, email: null };
  }

  // Get notification preferences
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .single();

  // Map notification type to email preference field
  const prefKey = getEmailPreferenceKey(notificationType);
  const shouldSend = !prefs || !prefKey || prefs[prefKey] !== false;

  return { shouldSend, email: user.email };
}

/**
 * Map notification type to email preference field
 */
function getEmailPreferenceKey(type: NotificationType): string | null {
  const mapping: Record<NotificationType, string | null> = {
    task_assigned: "email_task_assigned",
    task_completed: "email_task_completed",
    task_status_changed: "email_task_assigned", // Use same as assigned
    task_due_soon: "email_task_due_soon",
    task_overdue: "email_task_overdue",
    task_comment: "email_new_task", // Grouped with new task
    mention: "email_new_task",
    client_activity: "email_client_activity",
    system_alert: null, // Always send system alerts
    ai_suggestion: "ai_high_priority_detected",
  };
  return mapping[type];
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

function baseTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${APP_NAME}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: #1a1a2e; padding: 20px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; }
    .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${APP_NAME}</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>You're receiving this because of your notification settings.</p>
      <p><a href="${APP_URL}/settings/notifications">Manage notifications</a></p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// ============================================================================
// EMAIL NOTIFICATION FUNCTIONS
// ============================================================================

/**
 * Send task assigned email notification
 */
export async function emailTaskAssigned(
  assigneeId: string,
  taskId: string,
  taskTitle: string,
  assignedByName: string
): Promise<void> {
  const { shouldSend, email } = await shouldSendEmail(assigneeId, "task_assigned");
  if (!shouldSend || !email) return;

  const taskUrl = `${APP_URL}/taskpool?task=${taskId}`;

  await sendEmail({
    to: email,
    subject: `New Task Assigned: ${taskTitle}`,
    html: baseTemplate(`
      <h2>You have a new task</h2>
      <p><strong>${assignedByName}</strong> assigned you a task:</p>
      <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
        <strong>${taskTitle}</strong>
      </div>
      <p>
        <a href="${taskUrl}" class="button">View Task</a>
      </p>
    `),
    text: `New task assigned: ${taskTitle}\n\nAssigned by: ${assignedByName}\n\nView task: ${taskUrl}`,
  });
}

/**
 * Send task completed email notification
 */
export async function emailTaskCompleted(
  userId: string,
  taskId: string,
  taskTitle: string,
  completedByName: string
): Promise<void> {
  const { shouldSend, email } = await shouldSendEmail(userId, "task_completed");
  if (!shouldSend || !email) return;

  const taskUrl = `${APP_URL}/taskpool?task=${taskId}`;

  await sendEmail({
    to: email,
    subject: `Task Completed: ${taskTitle}`,
    html: baseTemplate(`
      <h2>Task Completed</h2>
      <p><strong>${completedByName}</strong> completed the task:</p>
      <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px; margin: 20px 0;">
        <strong>${taskTitle}</strong>
      </div>
      <p>
        <a href="${taskUrl}" class="button">View Details</a>
      </p>
    `),
    text: `Task completed: ${taskTitle}\n\nCompleted by: ${completedByName}\n\nView details: ${taskUrl}`,
  });
}

/**
 * Send task due soon email notification
 */
export async function emailTaskDueSoon(
  assigneeId: string,
  taskId: string,
  taskTitle: string,
  dueDate: string
): Promise<void> {
  const { shouldSend, email } = await shouldSendEmail(assigneeId, "task_due_soon");
  if (!shouldSend || !email) return;

  const taskUrl = `${APP_URL}/taskpool?task=${taskId}`;
  const formattedDate = new Date(dueDate).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  await sendEmail({
    to: email,
    subject: `Task Due Soon: ${taskTitle}`,
    html: baseTemplate(`
      <h2>Task Due Soon</h2>
      <p>Your task is due soon:</p>
      <div style="background: #fefce8; border-left: 4px solid #eab308; padding: 15px; margin: 20px 0;">
        <strong>${taskTitle}</strong>
        <br><small>Due: ${formattedDate}</small>
      </div>
      <p>
        <a href="${taskUrl}" class="button">View Task</a>
      </p>
    `),
    text: `Task due soon: ${taskTitle}\n\nDue: ${formattedDate}\n\nView task: ${taskUrl}`,
  });
}

/**
 * Send task overdue email notification
 */
export async function emailTaskOverdue(
  assigneeId: string,
  taskId: string,
  taskTitle: string,
  dueDate: string
): Promise<void> {
  const { shouldSend, email } = await shouldSendEmail(assigneeId, "task_overdue");
  if (!shouldSend || !email) return;

  const taskUrl = `${APP_URL}/taskpool?task=${taskId}`;
  const formattedDate = new Date(dueDate).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  await sendEmail({
    to: email,
    subject: `OVERDUE: ${taskTitle}`,
    html: baseTemplate(`
      <h2 style="color: #dc2626;">Task Overdue</h2>
      <p>This task is past its due date and needs your attention:</p>
      <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
        <strong>${taskTitle}</strong>
        <br><small style="color: #dc2626;">Was due: ${formattedDate}</small>
      </div>
      <p>
        <a href="${taskUrl}" class="button" style="background: #dc2626;">Complete Task Now</a>
      </p>
    `),
    text: `OVERDUE: ${taskTitle}\n\nWas due: ${formattedDate}\n\nComplete task: ${taskUrl}`,
  });
}

/**
 * Send mention notification email
 */
export async function emailMention(
  userId: string,
  mentionedByName: string,
  context: string,
  link: string
): Promise<void> {
  const { shouldSend, email } = await shouldSendEmail(userId, "mention");
  if (!shouldSend || !email) return;

  const fullLink = link.startsWith("http") ? link : `${APP_URL}${link}`;

  await sendEmail({
    to: email,
    subject: `${mentionedByName} mentioned you`,
    html: baseTemplate(`
      <h2>You were mentioned</h2>
      <p><strong>${mentionedByName}</strong> mentioned you:</p>
      <div style="background: #f8fafc; border-left: 4px solid #6366f1; padding: 15px; margin: 20px 0;">
        ${context}
      </div>
      <p>
        <a href="${fullLink}" class="button">View Context</a>
      </p>
    `),
    text: `${mentionedByName} mentioned you:\n\n${context}\n\nView: ${fullLink}`,
  });
}

/**
 * Send weekly summary email
 */
export async function emailWeeklySummary(
  userId: string,
  stats: {
    tasks_completed: number;
    tasks_created: number;
    tasks_pending: number;
    tasks_overdue: number;
  }
): Promise<void> {
  const { shouldSend, email } = await shouldSendEmail(userId, "system_alert");
  if (!shouldSend || !email) return;

  const dashboardUrl = `${APP_URL}/dashboard`;

  await sendEmail({
    to: email,
    subject: `Your Weekly Summary - ${APP_NAME}`,
    html: baseTemplate(`
      <h2>Your Weekly Summary</h2>
      <p>Here's what happened this week:</p>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">
            <strong style="color: #22c55e;">✓ Tasks Completed</strong>
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-size: 24px; font-weight: bold;">
            ${stats.tasks_completed}
          </td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">
            <strong style="color: #3b82f6;">+ Tasks Created</strong>
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-size: 24px; font-weight: bold;">
            ${stats.tasks_created}
          </td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">
            <strong style="color: #eab308;">⏳ Pending</strong>
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-size: 24px; font-weight: bold;">
            ${stats.tasks_pending}
          </td>
        </tr>
        ${stats.tasks_overdue > 0 ? `
        <tr>
          <td style="padding: 10px;">
            <strong style="color: #dc2626;">⚠ Overdue</strong>
          </td>
          <td style="padding: 10px; text-align: right; font-size: 24px; font-weight: bold; color: #dc2626;">
            ${stats.tasks_overdue}
          </td>
        </tr>
        ` : ''}
      </table>

      <p>
        <a href="${dashboardUrl}" class="button">View Dashboard</a>
      </p>
    `),
    text: `Weekly Summary\n\nTasks Completed: ${stats.tasks_completed}\nTasks Created: ${stats.tasks_created}\nPending: ${stats.tasks_pending}\nOverdue: ${stats.tasks_overdue}\n\nView Dashboard: ${dashboardUrl}`,
  });
}
