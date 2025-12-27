import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth Confirmation Handler
 *
 * Handles email confirmation links from Supabase auth emails.
 * Verifies the token and redirects the user appropriately.
 */

// Supabase email OTP types (must match Supabase's EmailOtpType)
type EmailOtpType =
  | "signup"
  | "recovery"
  | "invite"
  | "magiclink"
  | "email_change";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") || "/dashboard";

  if (!token_hash || !type) {
    return NextResponse.redirect(
      new URL("/login?error=missing_token", request.url)
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    token_hash,
    type,
  });

  if (error) {
    console.error("[Auth Confirm] Verification error:", error.message);

    // Redirect based on error type
    if (error.message.includes("expired")) {
      return NextResponse.redirect(
        new URL("/login?error=link_expired", request.url)
      );
    }

    return NextResponse.redirect(
      new URL("/login?error=invalid_link", request.url)
    );
  }

  // Handle different confirmation types
  switch (type) {
    case "recovery":
      // Redirect to password reset page
      return NextResponse.redirect(new URL("/reset-password", request.url));

    case "signup":
    case "invite":
      // Redirect to dashboard with welcome message
      return NextResponse.redirect(
        new URL("/dashboard?welcome=true", request.url)
      );

    case "email_change":
      // Redirect to settings with confirmation
      return NextResponse.redirect(
        new URL("/settings?email_changed=true", request.url)
      );

    case "magiclink":
    default:
      // Redirect to the intended destination
      return NextResponse.redirect(new URL(next, request.url));
  }
}
