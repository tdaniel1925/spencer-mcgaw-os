import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/**
 * Supabase Auth Email Hook
 *
 * This endpoint receives auth email requests from Supabase and sends them via Resend
 * with branded templates.
 *
 * SETUP IN SUPABASE DASHBOARD:
 * 1. Go to Project Settings → Auth → Auth Hooks
 * 2. Enable "Send Email" hook
 * 3. Set Hook type to "HTTPS"
 * 4. Set URL to: https://your-domain.com/api/auth/email-hook
 * 5. Click "Generate secret" and copy it
 * 6. Add SUPABASE_AUTH_HOOK_SECRET=v1,whsec_xxx to your .env.local
 */

const WEBHOOK_SECRET = process.env.SUPABASE_AUTH_HOOK_SECRET;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || "notifications@spencermcgaw.com";
const APP_NAME = "Spencer McGaw Hub";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Verify Supabase webhook signature
 */
function verifyWebhookSignature(payload: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;

  // Extract the actual secret from the v1,whsec_ format
  const secretKey = secret.replace("v1,whsec_", "");

  // Compute HMAC-SHA256
  const expectedSignature = crypto
    .createHmac("sha256", secretKey)
    .update(payload)
    .digest("hex");

  // Compare signatures (timing-safe)
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

// Email types from Supabase
type EmailType =
  | "signup"
  | "recovery"
  | "invite"
  | "magiclink"
  | "email_change"
  | "reauthentication";

interface EmailHookPayload {
  user: {
    id: string;
    email: string;
    user_metadata?: {
      full_name?: string;
    };
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: EmailType;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

export async function POST(request: NextRequest) {
  if (!RESEND_API_KEY) {
    console.error("[Auth Email Hook] RESEND_API_KEY not configured");
    return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
  }

  try {
    // Get raw body for signature verification
    const rawBody = await request.text();

    // Verify webhook signature if secret is configured
    if (WEBHOOK_SECRET) {
      const signature = request.headers.get("x-supabase-signature");
      if (!verifyWebhookSignature(rawBody, signature, WEBHOOK_SECRET)) {
        console.error("[Auth Email Hook] Invalid webhook signature");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const payload: EmailHookPayload = JSON.parse(rawBody);
    const { user, email_data } = payload;

    const email = user.email;
    const name = user.user_metadata?.full_name || email.split("@")[0];
    const actionType = email_data.email_action_type;

    // Build the confirmation/action URL
    const actionUrl = buildActionUrl(email_data);

    // Get the appropriate email template
    const { subject, html, text } = getEmailTemplate(actionType, name, actionUrl);

    // Send via Resend
    const { Resend } = await import("resend");
    const resend = new Resend(RESEND_API_KEY);

    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject,
      html,
      text,
    });

    if (error) {
      console.error("[Auth Email Hook] Resend error:", error);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    console.log(`[Auth Email Hook] Sent ${actionType} email to ${email}, ID: ${data?.id}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Auth Email Hook] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

function buildActionUrl(email_data: EmailHookPayload["email_data"]): string {
  const { token_hash, redirect_to, email_action_type } = email_data;

  // Map action types to Supabase auth endpoints
  const typeMap: Record<EmailType, string> = {
    signup: "signup",
    recovery: "recovery",
    invite: "invite",
    magiclink: "magiclink",
    email_change: "email_change",
    reauthentication: "reauthentication",
  };

  const type = typeMap[email_action_type] || email_action_type;

  // Build the Supabase auth callback URL
  const baseUrl = redirect_to || APP_URL;
  return `${baseUrl}/auth/confirm?token_hash=${token_hash}&type=${type}`;
}

function getEmailTemplate(
  type: EmailType,
  name: string,
  actionUrl: string
): { subject: string; html: string; text: string } {
  const templates: Record<EmailType, { subject: string; content: string; buttonText: string; textContent: string }> = {
    signup: {
      subject: `Confirm your email - ${APP_NAME}`,
      content: `
        <h2>Welcome to ${APP_NAME}!</h2>
        <p>Hi <strong>${name}</strong>,</p>
        <p>Thanks for signing up! Please confirm your email address to get started.</p>
      `,
      buttonText: "Confirm Email",
      textContent: `Welcome to ${APP_NAME}!\n\nHi ${name},\n\nThanks for signing up! Please confirm your email address.`,
    },
    recovery: {
      subject: `Reset your password - ${APP_NAME}`,
      content: `
        <h2>Password Reset Request</h2>
        <p>Hi <strong>${name}</strong>,</p>
        <p>We received a request to reset your password. Click the button below to create a new password.</p>
        <p style="color: #666; font-size: 14px;">This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.</p>
      `,
      buttonText: "Reset Password",
      textContent: `Password Reset Request\n\nHi ${name},\n\nWe received a request to reset your password.\n\nThis link will expire in 1 hour.`,
    },
    invite: {
      subject: `You're invited to ${APP_NAME}`,
      content: `
        <h2>You've Been Invited!</h2>
        <p>Hi <strong>${name}</strong>,</p>
        <p>You've been invited to join ${APP_NAME}. Click the button below to accept your invitation and set up your account.</p>
      `,
      buttonText: "Accept Invitation",
      textContent: `You've Been Invited to ${APP_NAME}!\n\nHi ${name},\n\nClick the link below to accept your invitation and set up your account.`,
    },
    magiclink: {
      subject: `Your login link - ${APP_NAME}`,
      content: `
        <h2>Magic Link Login</h2>
        <p>Hi <strong>${name}</strong>,</p>
        <p>Click the button below to log in to your account. This link will expire in 1 hour.</p>
        <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
      `,
      buttonText: "Log In",
      textContent: `Magic Link Login\n\nHi ${name},\n\nClick the link below to log in. This link will expire in 1 hour.`,
    },
    email_change: {
      subject: `Confirm your new email - ${APP_NAME}`,
      content: `
        <h2>Confirm Email Change</h2>
        <p>Hi <strong>${name}</strong>,</p>
        <p>You requested to change your email address. Click the button below to confirm this change.</p>
        <p style="color: #666; font-size: 14px;">If you didn't request this change, please contact support immediately.</p>
      `,
      buttonText: "Confirm New Email",
      textContent: `Confirm Email Change\n\nHi ${name},\n\nYou requested to change your email address. Click the link to confirm.`,
    },
    reauthentication: {
      subject: `Confirm your identity - ${APP_NAME}`,
      content: `
        <h2>Identity Confirmation Required</h2>
        <p>Hi <strong>${name}</strong>,</p>
        <p>For your security, please confirm your identity by clicking the button below.</p>
      `,
      buttonText: "Confirm Identity",
      textContent: `Identity Confirmation Required\n\nHi ${name},\n\nPlease confirm your identity by clicking the link below.`,
    },
  };

  const template = templates[type] || templates.signup;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${template.subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; }
    .header { background: #1a1a2e; padding: 24px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; font-weight: 600; }
    .content { padding: 40px 30px; }
    .content h2 { color: #1a1a2e; margin-top: 0; }
    .button { display: inline-block; background: #3b82f6; color: white !important; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 24px 0; }
    .button:hover { background: #2563eb; }
    .footer { background: #f8fafc; padding: 24px; text-align: center; font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0; }
    .footer a { color: #3b82f6; text-decoration: none; }
    .divider { height: 1px; background: #e2e8f0; margin: 24px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${APP_NAME}</h1>
    </div>
    <div class="content">
      ${template.content}
      <p style="text-align: center;">
        <a href="${actionUrl}" class="button">${template.buttonText}</a>
      </p>
      <div class="divider"></div>
      <p style="font-size: 13px; color: #64748b;">
        If the button doesn't work, copy and paste this link into your browser:
        <br>
        <a href="${actionUrl}" style="color: #3b82f6; word-break: break-all;">${actionUrl}</a>
      </p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
      <p>
        <a href="${APP_URL}">Visit our website</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const text = `${template.textContent}\n\n${template.buttonText}: ${actionUrl}\n\n---\n${APP_NAME}`;

  return { subject: template.subject, html, text };
}
