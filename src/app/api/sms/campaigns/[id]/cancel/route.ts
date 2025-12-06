import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST - Cancel a campaign
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
    // Get the campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("sms_bulk_campaigns")
      .select("status")
      .eq("id", id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (campaign.status === "completed" || campaign.status === "cancelled") {
      return NextResponse.json(
        { error: "Campaign is already completed or cancelled" },
        { status: 400 }
      );
    }

    // Update campaign status to cancelled
    const { error: updateError } = await supabase
      .from("sms_bulk_campaigns")
      .update({
        status: "cancelled",
        completed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: "Failed to cancel campaign" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error cancelling campaign:", error);
    return NextResponse.json({ error: "Failed to cancel campaign" }, { status: 500 });
  }
}
