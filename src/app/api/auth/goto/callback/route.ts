import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, setupGoToIntegration } from "@/lib/goto";
import logger from "@/lib/logger";

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
    logger.error("[GoTo Callback] OAuth error", new Error(errorDescription || error), { error, errorDescription });
    const redirectUrl = new URL("/calls", request.url);
    redirectUrl.searchParams.set("goto_error", "true");
    redirectUrl.searchParams.set("error_message", errorDescription || error);
    return NextResponse.redirect(redirectUrl);
  }

  // Verify authorization code
  if (!code) {
    logger.error("[GoTo Callback] Missing authorization code");
    const redirectUrl = new URL("/calls", request.url);
    redirectUrl.searchParams.set("goto_error", "true");
    redirectUrl.searchParams.set("error_message", "Missing authorization code");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Set up webhook subscriptions
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/goto`;

    await setupGoToIntegration(webhookUrl);

    // Tokens are now stored in database via exchangeCodeForTokens
    // Redirect back to Phone Agent page with success indicator
    const redirectUrl = new URL("/calls", request.url);
    redirectUrl.searchParams.set("goto_connected", "true");
    redirectUrl.searchParams.set("account_key", tokens.accountKey);

    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    logger.error("[GoTo Callback] Error processing callback:", err);
    const redirectUrl = new URL("/calls", request.url);
    redirectUrl.searchParams.set("goto_error", "true");
    redirectUrl.searchParams.set(
      "error_message",
      err instanceof Error ? err.message : "Failed to connect"
    );
    return NextResponse.redirect(redirectUrl);
  }
}
