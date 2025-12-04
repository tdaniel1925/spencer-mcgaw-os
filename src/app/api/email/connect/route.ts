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
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI || `${request.nextUrl.origin}/api/email/callback`;

  if (!clientId) {
    return NextResponse.json(
      { error: "Microsoft OAuth not configured" },
      { status: 500 }
    );
  }

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
  authUrl.searchParams.set("prompt", "consent");

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
