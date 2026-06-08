import { NextRequest, NextResponse } from "next/server";

// Microsoft OAuth endpoints
const MICROSOFT_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";

// Required Graph API scopes for email, calendar, and contacts
const SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  // Email
  "Mail.Read",
  "Mail.ReadWrite",
  "Mail.Send",
  // Calendar
  "Calendars.Read",
  "Calendars.ReadWrite",
  // Contacts
  "Contacts.Read",
  "Contacts.ReadWrite",
  // User
  "User.Read",
].join(" ");

export async function GET(request: NextRequest) {
  // Support both naming conventions for Microsoft OAuth credentials
  const clientId = process.env.MICROSOFT_CLIENT_ID || process.env.MS_GRAPH_CLIENT_ID;

  // Use explicit redirect URI from env, or construct from NEXT_PUBLIC_APP_URL, or fallback to request origin
  const baseUrl = process.env.MS_GRAPH_REDIRECT_URI
    ? null // If MS_GRAPH_REDIRECT_URI is set, use it directly
    : (process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin);
  const redirectUri = process.env.MS_GRAPH_REDIRECT_URI || `${baseUrl}/api/email/callback`;

  if (!clientId) {
    return NextResponse.json(
      { error: "Microsoft OAuth not configured" },
      { status: 500 }
    );
  }

  // Check if admin consent is requested (for organizations requiring IT approval)
  const searchParams = request.nextUrl.searchParams;
  const adminConsent = searchParams.get("admin") === "true";

  // Generate state for CSRF protection
  const state = crypto.randomUUID();

  // Build the Microsoft OAuth URL
  const authUrl = new URL(MICROSOFT_AUTH_URL);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("response_mode", "query");
  authUrl.searchParams.set("state", state);

  // FIX: Use select_account instead of consent
  // - select_account: Let user pick account, MS decides if consent needed
  // - consent: Force consent every time (breaks work/school accounts with pre-consent)
  // For admin consent flow, still use consent to ensure proper approval
  authUrl.searchParams.set("prompt", adminConsent ? "admin_consent" : "select_account");

  // In production, store state in session/cookie for verification
  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
  });

  return response;
}
