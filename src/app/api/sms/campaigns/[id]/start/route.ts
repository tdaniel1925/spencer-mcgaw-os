import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST - Start sending a campaign
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
      .select("*")
      .eq("id", id)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (campaign.status !== "draft" && campaign.status !== "scheduled") {
      return NextResponse.json(
        { error: "Campaign is not in a startable state" },
        { status: 400 }
      );
    }

    // Update campaign status to sending
    const { error: updateError } = await supabase
      .from("sms_bulk_campaigns")
      .update({
        status: "sending",
        started_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: "Failed to start campaign" }, { status: 500 });
    }

    // Get recipients
    const { data: recipients, error: recipientsError } = await supabase
      .from("sms_campaign_recipients")
      .select(`
        *,
        contact:client_contacts!contact_id (
          id,
          first_name,
          last_name,
          phone,
          mobile,
          client_id
        )
      `)
      .eq("campaign_id", id)
      .eq("status", "pending");

    if (recipientsError) {
      return NextResponse.json({ error: "Failed to get recipients" }, { status: 500 });
    }

    // Get Twilio credentials from SMS settings
    const { data: settings } = await supabase
      .from("sms_settings")
      .select("twilio_account_sid, twilio_auth_token, twilio_phone_number")
      .single();

    const twilioSid = settings?.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = settings?.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = settings?.twilio_phone_number || process.env.TWILIO_PHONE_NUMBER;

    if (!twilioSid || !twilioToken || !fromNumber) {
      // Mark campaign as failed if no credentials
      await supabase
        .from("sms_bulk_campaigns")
        .update({ status: "cancelled" })
        .eq("id", id);

      return NextResponse.json(
        { error: "Twilio credentials not configured" },
        { status: 500 }
      );
    }

    let sentCount = 0;
    let deliveredCount = 0;
    let failedCount = 0;

    // Send to each recipient
    for (const recipient of recipients || []) {
      const phoneNumber = recipient.contact?.mobile || recipient.contact?.phone;
      if (!phoneNumber) {
        failedCount++;
        await supabase
          .from("sms_campaign_recipients")
          .update({
            status: "failed",
            error_message: "No phone number",
          })
          .eq("id", recipient.id);
        continue;
      }

      try {
        // Personalize message
        let messageBody = campaign.message_body;
        if (recipient.contact) {
          messageBody = messageBody
            .replace(/\{\{first_name\}\}/g, recipient.contact.first_name || "")
            .replace(/\{\{last_name\}\}/g, recipient.contact.last_name || "");
        }

        // Send via Twilio
        const twilioResponse = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64")}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              From: fromNumber,
              To: phoneNumber,
              Body: messageBody,
            }),
          }
        );

        if (twilioResponse.ok) {
          sentCount++;
          deliveredCount++; // Assume delivered for now, webhook will update
          await supabase
            .from("sms_campaign_recipients")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
            })
            .eq("id", recipient.id);
        } else {
          const errorData = await twilioResponse.json();
          failedCount++;
          await supabase
            .from("sms_campaign_recipients")
            .update({
              status: "failed",
              error_message: errorData.message || "Failed to send",
            })
            .eq("id", recipient.id);
        }
      } catch (sendError) {
        failedCount++;
        await supabase
          .from("sms_campaign_recipients")
          .update({
            status: "failed",
            error_message: "Send error",
          })
          .eq("id", recipient.id);
      }

      // Update campaign progress
      await supabase
        .from("sms_bulk_campaigns")
        .update({
          sent_count: sentCount,
          delivered_count: deliveredCount,
          failed_count: failedCount,
        })
        .eq("id", id);
    }

    // Mark campaign as completed
    await supabase
      .from("sms_bulk_campaigns")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        sent_count: sentCount,
        delivered_count: deliveredCount,
        failed_count: failedCount,
      })
      .eq("id", id);

    return NextResponse.json({
      success: true,
      sent_count: sentCount,
      delivered_count: deliveredCount,
      failed_count: failedCount,
    });
  } catch (error) {
    console.error("Error starting campaign:", error);
    return NextResponse.json({ error: "Failed to start campaign" }, { status: 500 });
  }
}
