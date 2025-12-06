import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - Get campaign details
export async function GET(
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
    const { data: campaign, error } = await supabase
      .from("sms_bulk_campaigns")
      .select(`
        *,
        template:sms_templates!template_id (
          id,
          name,
          body
        ),
        recipients:sms_campaign_recipients (
          id,
          contact_id,
          status,
          sent_at,
          delivered_at,
          error_message,
          contact:client_contacts!contact_id (
            id,
            first_name,
            last_name,
            phone,
            mobile
          )
        )
      `)
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json(campaign);
  } catch (error) {
    console.error("Error fetching campaign:", error);
    return NextResponse.json({ error: "Failed to fetch campaign" }, { status: 500 });
  }
}

// PUT - Update campaign
export async function PUT(
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
    const body = await request.json();

    // Only allow updates if campaign is in draft status
    const { data: existingCampaign } = await supabase
      .from("sms_bulk_campaigns")
      .select("status")
      .eq("id", id)
      .single();

    if (existingCampaign?.status !== "draft") {
      return NextResponse.json(
        { error: "Can only update draft campaigns" },
        { status: 400 }
      );
    }

    const { data: campaign, error } = await supabase
      .from("sms_bulk_campaigns")
      .update(body)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 });
    }

    return NextResponse.json(campaign);
  } catch (error) {
    console.error("Error updating campaign:", error);
    return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 });
  }
}

// DELETE - Delete campaign
export async function DELETE(
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
    // Delete recipients first
    await supabase
      .from("sms_campaign_recipients")
      .delete()
      .eq("campaign_id", id);

    // Delete campaign
    const { error } = await supabase
      .from("sms_bulk_campaigns")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: "Failed to delete campaign" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting campaign:", error);
    return NextResponse.json({ error: "Failed to delete campaign" }, { status: 500 });
  }
}
