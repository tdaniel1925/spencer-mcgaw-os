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
    logger.warn("[Email] Resend client not available - RESEND_API_KEY may not be configured");
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
      logger.error("[Email] Failed to send", { to: options.to, subject: options.subject, error });
      return false;
    }

    // Log successful email send with Resend message ID
    logger.info("[Email] Successfully sent", {
      to: options.to,
      subject: options.subject,
      messageId: data?.id,
    });

    return true;
  } catch (error) {
    logger.error("[Email] Error sending email", { to: options.to, subject: options.subject, error });
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

  // Get user email and notification preferences from user_profiles table
  const { data: user } = await supabase
    .from("user_profiles")
    .select("email, notification_preferences")
    .eq("id", userId)
    .single();

  if (!user?.email) {
    return { shouldSend: false, email: null };
  }

  // Check notification preferences (JSONB field)
  const prefs = user.notification_preferences as Record<string, boolean> | null;

  // Default: send emails unless explicitly disabled
  // prefs.email controls all email notifications
  const emailEnabled = !prefs || prefs.email !== false;

  return { shouldSend: emailEnabled, email: user.email };
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
 * Send welcome/invite email to new user
 */
export async function emailWelcome(
  email: string,
  fullName: string,
  tempPassword?: string
): Promise<boolean> {
  const loginUrl = `${APP_URL}/login`;

  const passwordSection = tempPassword
    ? `
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
        <strong>Your Login Credentials:</strong>
        <div style="margin-top: 10px;">
          <div style="margin-bottom: 8px;"><strong>Email:</strong> ${email}</div>
          <div><strong>Password:</strong> <span style="font-family: monospace; font-size: 16px; padding: 4px 8px; background: white; border-radius: 4px;">${tempPassword}</span></div>
        </div>
        <small style="color: #92400e; display: block; margin-top: 10px;">For security, please change your password after logging in.</small>
      </div>
    `
    : '';

  return sendEmail({
    to: email,
    subject: `Welcome to ${APP_NAME} - Your Account is Ready!`,
    html: baseTemplate(`
      <h2>Welcome to ${APP_NAME}!</h2>
      <p>Hi <strong>${fullName}</strong>,</p>

      <p>Thank you for joining us! <strong>BotMakers</strong> is pleased to have you on board.</p>

      <p>Your account has been created and you now have access to a powerful suite of tools designed to streamline your workflow:</p>

      <div style="background: #f0f9ff; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #0369a1;">What You Can Do:</h3>
        <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
          <li><strong>Task Management</strong> - Organize, assign, and track tasks with our intelligent taskpool system</li>
          <li><strong>Email Integration</strong> - Manage all your emails with AI-powered classification and sorting</li>
          <li><strong>Client Management</strong> - Keep all your client information organized in one place</li>
          <li><strong>Team Chat</strong> - Collaborate seamlessly with your team in real-time</li>
          <li><strong>File Storage</strong> - Securely store and share documents</li>
          <li><strong>Calendar & Calls</strong> - Schedule meetings and track all communications</li>
        </ul>
      </div>

      ${passwordSection}

      <p style="text-align: center; margin: 30px 0;">
        <a href="${loginUrl}" class="button" style="font-size: 16px; padding: 14px 32px;">Get Started Now</a>
      </p>

      <div style="background: #f8fafc; border-radius: 8px; padding: 15px; margin-top: 30px;">
        <p style="margin: 0; color: #475569; font-size: 14px;">
          <strong>Need help getting started?</strong><br>
          Check out the Help section in the app for guides and FAQs, or reach out to your administrator.
        </p>
      </div>

      <p style="margin-top: 30px; color: #666; text-align: center;">
        We're excited to have you with us!<br>
        <strong>— The BotMakers Team</strong>
      </p>
    `),
    text: `Welcome to ${APP_NAME}!\n\nHi ${fullName},\n\nThank you for joining us! BotMakers is pleased to have you on board.\n\nYour account has been created and you now have access to:\n- Task Management - Organize, assign, and track tasks\n- Email Integration - AI-powered email classification\n- Client Management - Keep client info organized\n- Team Chat - Real-time collaboration\n- File Storage - Secure document storage\n- Calendar & Calls - Schedule and track communications\n\n${tempPassword ? `Your Login Credentials:\nEmail: ${email}\nPassword: ${tempPassword}\n\nPlease change your password after logging in.\n\n` : ''}Log in now: ${loginUrl}\n\nWe're excited to have you with us!\n— The BotMakers Team`,
  });
}

/**
 * Generate welcome email HTML for preview (without sending)
 */
export function getWelcomeEmailPreview(
  fullName: string,
  email: string,
  tempPassword?: string
): { subject: string; html: string } {
  const loginUrl = `${APP_URL}/login`;

  const passwordSection = tempPassword
    ? `
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
        <strong>Your Login Credentials:</strong>
        <div style="margin-top: 10px;">
          <div style="margin-bottom: 8px;"><strong>Email:</strong> ${email}</div>
          <div><strong>Password:</strong> <span style="font-family: monospace; font-size: 16px; padding: 4px 8px; background: white; border-radius: 4px;">${tempPassword}</span></div>
        </div>
        <small style="color: #92400e; display: block; margin-top: 10px;">For security, please change your password after logging in.</small>
      </div>
    `
    : '';

  return {
    subject: `Welcome to ${APP_NAME} - Your Account is Ready!`,
    html: baseTemplate(`
      <h2>Welcome to ${APP_NAME}!</h2>
      <p>Hi <strong>${fullName}</strong>,</p>

      <p>Thank you for joining us! <strong>BotMakers</strong> is pleased to have you on board.</p>

      <p>Your account has been created and you now have access to a powerful suite of tools designed to streamline your workflow:</p>

      <div style="background: #f0f9ff; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #0369a1;">What You Can Do:</h3>
        <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
          <li><strong>Task Management</strong> - Organize, assign, and track tasks with our intelligent taskpool system</li>
          <li><strong>Email Integration</strong> - Manage all your emails with AI-powered classification and sorting</li>
          <li><strong>Client Management</strong> - Keep all your client information organized in one place</li>
          <li><strong>Team Chat</strong> - Collaborate seamlessly with your team in real-time</li>
          <li><strong>File Storage</strong> - Securely store and share documents</li>
          <li><strong>Calendar & Calls</strong> - Schedule meetings and track all communications</li>
        </ul>
      </div>

      ${passwordSection}

      <p style="text-align: center; margin: 30px 0;">
        <a href="${loginUrl}" class="button" style="font-size: 16px; padding: 14px 32px;">Get Started Now</a>
      </p>

      <div style="background: #f8fafc; border-radius: 8px; padding: 15px; margin-top: 30px;">
        <p style="margin: 0; color: #475569; font-size: 14px;">
          <strong>Need help getting started?</strong><br>
          Check out the Help section in the app for guides and FAQs, or reach out to your administrator.
        </p>
      </div>

      <p style="margin-top: 30px; color: #666; text-align: center;">
        We're excited to have you with us!<br>
        <strong>— The BotMakers Team</strong>
      </p>
    `),
  };
}

/**
 * Send password reset email
 */
export async function emailPasswordReset(
  email: string,
  fullName: string,
  resetLink: string
): Promise<boolean> {
  return sendEmail({
    to: email,
    subject: `Reset Your Password - ${APP_NAME}`,
    html: baseTemplate(`
      <h2>Password Reset Request</h2>
      <p>Hi <strong>${fullName}</strong>,</p>
      <p>We received a request to reset your password. Click the button below to create a new password:</p>
      <p style="margin: 30px 0;">
        <a href="${resetLink}" class="button">Reset Password</a>
      </p>
      <p style="color: #666; font-size: 14px;">
        This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
      </p>
    `),
    text: `Password Reset Request\n\nHi ${fullName},\n\nWe received a request to reset your password.\n\nReset your password: ${resetLink}\n\nThis link will expire in 1 hour.`,
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
