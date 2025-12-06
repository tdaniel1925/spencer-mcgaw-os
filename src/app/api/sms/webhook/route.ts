import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Twilio webhook for inbound SMS messages
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Extract Twilio webhook data
    const from = formData.get("From")?.toString() || "";
    const to = formData.get("To")?.toString() || "";
    const body = formData.get("Body")?.toString() || "";
    const messageSid = formData.get("MessageSid")?.toString() || "";
    const numMedia = parseInt(formData.get("NumMedia")?.toString() || "0");

    // Get media URLs if any
    const mediaUrls: string[] = [];
    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = formData.get(`MediaUrl${i}`)?.toString();
      if (mediaUrl) {
        mediaUrls.push(mediaUrl);
      }
    }

    console.log(`Inbound SMS from ${from}: ${body}`);

    const supabase = await createClient();

    // Get SMS settings for opt-out handling
    const { data: settings } = await supabase
      .from("sms_settings")
      .select("*")
      .limit(1)
      .single();

    // Check for opt-out keywords
    const upperBody = body.toUpperCase().trim();
    const optOutKeywords = settings?.opt_out_keywords || ["STOP", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];
    const optInKeywords = settings?.opt_in_keywords || ["START", "YES", "UNSTOP"];

    // Find the conversation by phone number
    const { data: conversation } = await supabase
      .from("sms_conversations")
      .select(`
        *,
        contact:client_contacts!contact_id (
          id,
          first_name,
          last_name,
          client_id
        )
      `)
      .eq("phone_number", from)
      .single();

    // Handle opt-out
    if (optOutKeywords.includes(upperBody)) {
      if (conversation) {
        await supabase
          .from("sms_conversations")
          .update({
            is_opted_in: false,
            opted_out_at: new Date().toISOString(),
          })
          .eq("id", conversation.id);

        // Log opt-out
        await supabase.from("sms_opt_out_log").insert({
          phone_number: from,
          contact_id: conversation.contact_id,
          action: "opt_out",
          method: "sms_keyword",
        });
      }

      // Send opt-out confirmation via TwiML
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Message>${settings?.auto_opt_out_reply || "You have been unsubscribed. Reply START to resubscribe."}</Message>
        </Response>`,
        {
          headers: { "Content-Type": "text/xml" },
        }
      );
    }

    // Handle opt-in
    if (optInKeywords.includes(upperBody)) {
      if (conversation) {
        await supabase
          .from("sms_conversations")
          .update({
            is_opted_in: true,
            opted_in_at: new Date().toISOString(),
          })
          .eq("id", conversation.id);

        // Log opt-in
        await supabase.from("sms_opt_out_log").insert({
          phone_number: from,
          contact_id: conversation.contact_id,
          action: "opt_in",
          method: "sms_keyword",
        });
      }

      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Message>You have been resubscribed to SMS messages from Spencer McGaw CPA.</Message>
        </Response>`,
        {
          headers: { "Content-Type": "text/xml" },
        }
      );
    }

    // If no conversation exists for this number, we can't process the message
    if (!conversation) {
      console.log(`No conversation found for phone number: ${from}`);
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
        <Response></Response>`,
        {
          headers: { "Content-Type": "text/xml" },
        }
      );
    }

    // Create the inbound message record
    const { data: message, error: msgError } = await supabase
      .from("sms_messages")
      .insert({
        conversation_id: conversation.id,
        contact_id: conversation.contact_id,
        client_id: conversation.client_id,
        direction: "inbound",
        from_number: from,
        to_number: to,
        body,
        media_urls: mediaUrls.length > 0 ? mediaUrls : null,
        status: "received",
        twilio_sid: messageSid,
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (msgError) {
      console.error("Error saving inbound message:", msgError);
    }

    // Update conversation
    await supabase
      .from("sms_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: body.substring(0, 100),
        unread_count: (conversation.unread_count || 0) + 1,
      })
      .eq("id", conversation.id);

    // Log to client communications
    await supabase.from("client_communications").insert({
      client_id: conversation.client_id,
      contact_id: conversation.contact_id,
      communication_type: "sms",
      subject: "Inbound SMS",
      summary: body.substring(0, 200),
      direction: "inbound",
    });

    // Check for auto-responders
    const { data: autoResponders } = await supabase
      .from("sms_auto_responders")
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: false });

    let autoResponse = "";

    // Check after-hours responder
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinutes;
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

    const businessStart = settings?.business_hours_start ?
      parseInt(settings.business_hours_start.split(":")[0]) * 60 + parseInt(settings.business_hours_start.split(":")[1]) :
      9 * 60;
    const businessEnd = settings?.business_hours_end ?
      parseInt(settings.business_hours_end.split(":")[0]) * 60 + parseInt(settings.business_hours_end.split(":")[1]) :
      17 * 60;
    const businessDays = settings?.business_days || [1, 2, 3, 4, 5];

    const isOutsideBusinessHours =
      !businessDays.includes(currentDay) ||
      currentTime < businessStart ||
      currentTime > businessEnd;

    for (const responder of autoResponders || []) {
      if (responder.trigger_type === "after_hours" && isOutsideBusinessHours) {
        autoResponse = responder.response_body;
        break;
      }

      if (responder.trigger_type === "keyword" && responder.trigger_keywords) {
        const hasKeyword = responder.trigger_keywords.some((kw: string) =>
          upperBody.includes(kw.toUpperCase())
        );
        if (hasKeyword) {
          autoResponse = responder.response_body;
          // Update use count
          await supabase
            .from("sms_auto_responders")
            .update({ use_count: (responder.use_count || 0) + 1 })
            .eq("id", responder.id);
          break;
        }
      }
    }

    // Send auto-response if one was triggered
    if (autoResponse) {
      // Save the auto-response as an outbound message
      await supabase.from("sms_messages").insert({
        conversation_id: conversation.id,
        contact_id: conversation.contact_id,
        client_id: conversation.client_id,
        direction: "outbound",
        from_number: to,
        to_number: from,
        body: autoResponse,
        status: "sent",
        sent_at: new Date().toISOString(),
        metadata: { auto_response: true },
      });

      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Message>${autoResponse}</Message>
        </Response>`,
        {
          headers: { "Content-Type": "text/xml" },
        }
      );
    }

    // Return empty response (no auto-reply)
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
      <Response></Response>`,
      {
        headers: { "Content-Type": "text/xml" },
      }
    );
  } catch (error) {
    console.error("Error processing inbound SMS:", error);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
      <Response></Response>`,
      {
        headers: { "Content-Type": "text/xml" },
      }
    );
  }
}

// Status callback for delivery receipts
export async function PUT(request: NextRequest) {
  try {
    const formData = await request.formData();

    const messageSid = formData.get("MessageSid")?.toString();
    const messageStatus = formData.get("MessageStatus")?.toString();
    const errorCode = formData.get("ErrorCode")?.toString();
    const errorMessage = formData.get("ErrorMessage")?.toString();

    if (!messageSid) {
      return NextResponse.json({ error: "MessageSid required" }, { status: 400 });
    }

    const supabase = await createClient();

    const updates: Record<string, unknown> = {
      status: messageStatus,
    };

    if (messageStatus === "delivered") {
      updates.delivered_at = new Date().toISOString();
    }

    if (errorCode) {
      updates.error_code = errorCode;
      updates.error_message = errorMessage;
    }

    await supabase
      .from("sms_messages")
      .update(updates)
      .eq("twilio_sid", messageSid);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing status callback:", error);
    return NextResponse.json({ error: "Failed to process status" }, { status: 500 });
  }
}
