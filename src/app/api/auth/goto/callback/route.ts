import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, setupGoToIntegration } from "@/lib/goto";

/**
 * GET /api/auth/goto/callback
 *
 * OAuth callback handler for GoTo Connect.
 * Exchanges authorization code for tokens and sets up webhook subscriptions.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Handle OAuth errors
  if (error) {
    console.error("[GoTo Callback] OAuth error:", error, errorDescription);
    const redirectUrl = new URL("/settings/integrations", request.url);
    redirectUrl.searchParams.set("error", error);
    if (errorDescription) {
      redirectUrl.searchParams.set("error_description", errorDescription);
    }
    return NextResponse.redirect(redirectUrl);
  }

  // Verify authorization code
  if (!code) {
    console.error("[GoTo Callback] Missing authorization code");
    const redirectUrl = new URL("/settings/integrations", request.url);
    redirectUrl.searchParams.set("error", "missing_code");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    // Exchange code for tokens
    console.log("[GoTo Callback] Exchanging authorization code for tokens...");
    const tokens = await exchangeCodeForTokens(code);
    console.log("[GoTo Callback] Tokens received, account key:", tokens.accountKey);

    // Set up webhook subscriptions
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/goto`;
    console.log("[GoTo Callback] Setting up webhook subscriptions...", webhookUrl);

    const setupResult = await setupGoToIntegration(webhookUrl);
    console.log("[GoTo Callback] Setup complete:", setupResult);

    // TODO: Store tokens in database for persistence
    // For now, they're stored in memory and will be lost on restart

    // Return success page with account key visible
    // This allows user to copy the account key for their .env file
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>GoTo Connect - Connected Successfully</title>
          <style>
            body { font-family: system-ui, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .success { color: #22c55e; font-size: 24px; margin-bottom: 20px; }
            .info { background: #f1f5f9; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .info label { font-weight: 600; display: block; margin-bottom: 5px; }
            .info code { background: #e2e8f0; padding: 4px 8px; border-radius: 4px; font-size: 14px; }
            .btn { background: #3b82f6; color: white; padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="success">✓ GoTo Connect Connected Successfully!</div>
          <div class="info">
            <label>Account Key (add to .env.local):</label>
            <code>GOTO_ACCOUNT_KEY=${tokens.accountKey}</code>
          </div>
          <div class="info">
            <label>Channel ID:</label>
            <code>${setupResult.channelId}</code>
          </div>
          <div class="info">
            <label>Webhook URL:</label>
            <code>${webhookUrl}</code>
          </div>
          <div class="info">
            <label>Subscriptions:</label>
            <code>${setupResult.subscriptions.join(", ")}</code>
          </div>
          <p>The integration is now active. Call events will be sent to your webhook.</p>
          <button class="btn" onclick="window.location.href='/settings/integrations'">Go to Settings</button>
        </body>
      </html>
    `;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html" },
    });
  } catch (err) {
    console.error("[GoTo Callback] Error processing callback:", err);
    const redirectUrl = new URL("/settings/integrations", request.url);
    redirectUrl.searchParams.set("error", "token_exchange_failed");
    redirectUrl.searchParams.set(
      "error_description",
      err instanceof Error ? err.message : "Unknown error"
    );
    return NextResponse.redirect(redirectUrl);
  }
}
