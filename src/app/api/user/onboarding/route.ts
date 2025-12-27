import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/user/onboarding
 * Check if user has completed onboarding
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get user's onboarding status from user_profiles table
  const { data: userData } = await supabase
    .from("user_profiles")
    .select("onboarding_completed, created_at")
    .eq("id", user.id)
    .single();

  // Consider onboarding completed if:
  // 1. User has explicitly completed it
  // 2. User account is older than 7 days (legacy users)
  const isLegacyUser = userData?.created_at
    ? new Date(userData.created_at) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    : false;

  const completed = userData?.onboarding_completed || isLegacyUser;

  return NextResponse.json({
    completed,
    isLegacyUser,
  });
}

/**
 * POST /api/user/onboarding
 * Mark onboarding as completed
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Update user's onboarding status
  const { error } = await supabase
    .from("user_profiles")
    .update({
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    console.error("[Onboarding] Error updating status:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/user/onboarding
 * Reset onboarding (for testing or re-showing)
 */
export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Reset onboarding status
  const { error } = await supabase
    .from("user_profiles")
    .update({
      onboarding_completed: false,
      onboarding_completed_at: null,
    })
    .eq("id", user.id);

  if (error) {
    console.error("[Onboarding] Error resetting status:", error);
    return NextResponse.json({ error: "Failed to reset" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
