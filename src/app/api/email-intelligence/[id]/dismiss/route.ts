import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    // Update action items to dismissed
    await supabase
      .from("email_action_items")
      .update({
        status: "dismissed",
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
      action_type: "dismiss",
      action_value: null,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error dismissing intelligence:", error);
    return NextResponse.json({ error: "Failed to dismiss" }, { status: 500 });
  }
}
