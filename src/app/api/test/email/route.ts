import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Test endpoint to verify email notification sending via Resend
 * POST /api/test/email
 * Body: { to: "email@example.com" }
 */
export async function POST(request: NextRequest) {
  // Only allow in development or for admins
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Check if user is admin
  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (userData?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // Check if Resend is configured
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({
      error: "RESEND_API_KEY not configured",
      hint: "Add RESEND_API_KEY to your .env.local file"
    }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { to } = body;

    if (!to) {
      return NextResponse.json({ error: "Missing 'to' email address" }, { status: 400 });
    }

    // Dynamic import Resend
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    const emailFrom = process.env.EMAIL_FROM || "notifications@spencermcgaw.com";

    const { data, error } = await resend.emails.send({
      from: emailFrom,
      to: to,
      subject: "Test Email - Spencer McGaw Hub",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; }
            .header { background: #1a1a2e; padding: 20px; text-align: center; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { padding: 30px; }
            .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Spencer McGaw Hub</h1>
            </div>
            <div class="content">
              <h2>Test Email Successful!</h2>
              <p>This is a test email to verify that your email notification system is working correctly.</p>
              <p><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
              <p><strong>Sent by:</strong> ${user.email}</p>
            </div>
            <div class="footer">
              <p>This is a test email from Spencer McGaw Hub.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Test Email - Spencer McGaw Hub\n\nThis is a test email to verify that your email notification system is working correctly.\n\nSent at: ${new Date().toLocaleString()}\nSent by: ${user.email}`,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json({
        error: "Failed to send email",
        details: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${to}`,
      emailId: data?.id
    });
  } catch (error) {
    console.error("Error sending test email:", error);
    return NextResponse.json({
      error: "Failed to send email",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
