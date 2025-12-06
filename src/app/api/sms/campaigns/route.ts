import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - List all campaigns
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  try {
    let query = supabase
      .from("sms_bulk_campaigns")
      .select(`
        *,
        template:sms_templates!template_id (
          id,
          name
        )
      `)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    const { data: campaigns, error } = await query;

    if (error) {
      console.error("Error fetching campaigns:", error);
      return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 });
    }

    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 });
  }
}

// POST - Create a new campaign
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, description, template_id, message_body, scheduled_at, recipients } = body;

    if (!name) {
      return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
    }

    if (!message_body) {
      return NextResponse.json({ error: "Message body is required" }, { status: 400 });
    }

    if (!recipients || recipients.length === 0) {
      return NextResponse.json({ error: "At least one recipient is required" }, { status: 400 });
    }

    // Create the campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("sms_bulk_campaigns")
      .insert({
        name,
        description,
        template_id: template_id || null,
        message_body,
        status: scheduled_at ? "scheduled" : "draft",
        scheduled_at: scheduled_at || null,
        total_recipients: recipients.length,
        sent_count: 0,
        delivered_count: 0,
        failed_count: 0,
        created_by: user.id,
      })
      .select()
      .single();

    if (campaignError) {
      console.error("Error creating campaign:", campaignError);
      return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
    }

    // Add recipients
    const recipientRecords = recipients.map((contactId: string) => ({
      campaign_id: campaign.id,
      contact_id: contactId,
      status: "pending",
    }));

    const { error: recipientsError } = await supabase
      .from("sms_campaign_recipients")
      .insert(recipientRecords);

    if (recipientsError) {
      console.error("Error adding recipients:", recipientsError);
      // Clean up campaign if recipients failed
      await supabase.from("sms_bulk_campaigns").delete().eq("id", campaign.id);
      return NextResponse.json({ error: "Failed to add recipients" }, { status: 500 });
    }

    return NextResponse.json(campaign);
  } catch (error) {
    console.error("Error creating campaign:", error);
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
  }
}
