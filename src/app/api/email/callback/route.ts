import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/shared/crypto";

const MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const MICROSOFT_GRAPH_URL = "https://graph.microsoft.com/v1.0";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Check for OAuth errors
  if (error) {
    console.error("OAuth error:", error, errorDescription);

    // Provide helpful error messages based on error type
    let userMessage = errorDescription || error;

    // Admin consent required
    if (error === "admin_consent_required" || errorDescription?.includes("AADSTS65004")) {
      userMessage =
        "Your organization requires admin approval for this app. Please contact your IT administrator or try the admin consent link.";
    }
    // User cancelled consent
    else if (error === "access_denied" && errorDescription?.includes("user cancelled")) {
      userMessage = "You cancelled the sign-in process. Please try again if you want to connect your email.";
    }
    // Interaction required (MFA, conditional access, etc.)
    else if (error === "interaction_required" || errorDescription?.includes("AADSTS50076")) {
      userMessage =
        "Additional authentication required. Please ensure multi-factor authentication is set up for your account.";
    }
    // Invalid client
    else if (error === "invalid_client" || errorDescription?.includes("AADSTS700016")) {
      userMessage = "App configuration error. Please contact support - the Microsoft app credentials may need to be updated.";
    }

    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(userMessage)}`, request.url)
    );
  }

  // Verify state matches (CSRF protection)
  const storedState = request.cookies.get("oauth_state")?.value;
  if (!state || state !== storedState) {
    return NextResponse.redirect(
      new URL("/settings?error=Invalid%20state%20parameter", request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/settings?error=No%20authorization%20code", request.url)
    );
  }

  // Support both naming conventions for Microsoft OAuth credentials
  const clientId = process.env.MICROSOFT_CLIENT_ID || process.env.MS_GRAPH_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET || process.env.MS_GRAPH_CLIENT_SECRET;

  // Use explicit redirect URI from env, or construct from NEXT_PUBLIC_APP_URL, or fallback to request origin
  const baseUrl = process.env.MS_GRAPH_REDIRECT_URI
    ? null
    : (process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin);
  const redirectUri = process.env.MS_GRAPH_REDIRECT_URI || `${baseUrl}/api/email/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/settings?error=OAuth%20not%20configured", request.url)
    );
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch(MICROSOFT_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("Token exchange error:", errorData);

      // Provide specific error message based on the error
      let userMessage = "Failed to exchange authorization code for token.";

      if (errorData.error === "invalid_grant") {
        userMessage =
          "The authorization code has expired or was already used. Please try connecting your email again.";
      } else if (errorData.error === "unauthorized_client" && errorData.error_description?.includes("AADSTS65001")) {
        // Check for admin consent required FIRST (more specific check)
        userMessage =
          "Your organization requires admin consent. Please ask your IT administrator to approve this app, or use the admin consent option.";
      } else if (errorData.error === "unauthorized_client") {
        // Generic unauthorized_client error
        userMessage =
          "App configuration error. The app may not be authorized for this account type. Please contact support.";
      }

      return NextResponse.redirect(
        new URL(`/settings?error=${encodeURIComponent(userMessage)}`, request.url)
      );
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokens;

    // Get user info from Microsoft Graph
    const userResponse = await fetch(`${MICROSOFT_GRAPH_URL}/me`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!userResponse.ok) {
      return NextResponse.redirect(
        new URL("/settings?error=Failed%20to%20get%20user%20info", request.url)
      );
    }

    const microsoftUser = await userResponse.json();

    // Get current Supabase user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(
        new URL("/login?error=Not%20authenticated", request.url)
      );
    }

    // Store the email connection in database with encrypted tokens
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    const { error: dbError } = await supabase
      .from("email_connections")
      .upsert({
        user_id: user.id,
        provider: "microsoft",
        email: microsoftUser.mail || microsoftUser.userPrincipalName,
        access_token: encrypt(access_token), // Encrypted with AES-256-GCM
        refresh_token: refresh_token ? encrypt(refresh_token) : null, // Encrypted with AES-256-GCM
        expires_at: expiresAt.toISOString(),
        is_active: true,
        sync_enabled: true,
        last_sync_at: null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id,email",
      });

    if (dbError) {
      console.error("Database error:", dbError);
      // Don't fail completely - connection might still work
    }

    // Trigger initial email sync in the background
    // This runs async - we don't wait for it to complete
    const syncUrl = new URL("/api/email-intelligence/sync", request.url);
    fetch(syncUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Pass auth cookie for authentication
        Cookie: request.headers.get("cookie") || "",
      },
    }).catch((err) => {
      console.error("Background sync trigger failed:", err);
      // Don't fail the callback - sync can be triggered manually later
    });

    // Clear the state cookie and redirect to email client
    const response = NextResponse.redirect(
      new URL("/email-client?success=Email%20connected%20successfully", request.url)
    );
    response.cookies.delete("oauth_state");

    return response;
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(
      new URL("/settings?error=Connection%20failed", request.url)
    );
  }
}
