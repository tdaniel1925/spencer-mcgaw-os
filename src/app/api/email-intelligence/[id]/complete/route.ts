import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/email-intelligence/[id]/complete
 *
 * Marks an email as processed/complete without creating tasks.
 * Use this when the user has dealt with the email manually or
 * already created specific tasks using the "Do it" buttons.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Get the classification
    const { data: classification, error: classError } = await supabase
      .from("email_classifications")
      .select("*")
      .eq("id", id)
      .single();

    if (classError || !classification) {
      return NextResponse.json({ error: "Classification not found" }, { status: 404 });
    }

    // Mark any remaining pending action items as skipped (not dismissed, not approved)
    await supabase
      .from("email_action_items")
      .update({
        status: "skipped",
        completed_at: new Date().toISOString(),
      })
      .eq("email_message_id", classification.email_message_id)
      .eq("status", "pending");

    // Log user action for learning
    await supabase.from("email_user_actions").insert({
      user_id: user.id,
      email_message_id: classification.email_message_id,
      ai_category: classification.category,
      ai_priority: classification.priority_score >= 60 ? "high" : "medium",
      action_type: "complete",
      action_value: null,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error completing intelligence:", error);
    return NextResponse.json({ error: "Failed to complete" }, { status: 500 });
  }
}
