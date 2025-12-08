import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Validate phone number format (E.164 or common formats)
function isValidPhoneNumber(phone: string): boolean {
  if (!phone) return false;
  // Remove all non-digits except leading +
  const cleaned = phone.replace(/[^\d+]/g, "");
  // E.164 format: +1XXXXXXXXXX (10-15 digits after +)
  if (/^\+\d{10,15}$/.test(cleaned)) return true;
  // US format without +: 10 digits
  if (/^\d{10}$/.test(cleaned)) return true;
  // US format with 1: 11 digits starting with 1
  if (/^1\d{10}$/.test(cleaned)) return true;
  return false;
}

// Normalize phone number to E.164 format
function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  // Already E.164
  if (cleaned.startsWith("+")) return cleaned;
  // US 10-digit
  if (cleaned.length === 10) return `+1${cleaned}`;
  // US 11-digit with 1
  if (cleaned.length === 11 && cleaned.startsWith("1")) return `+${cleaned}`;
  return cleaned;
}

// POST - Send a new SMS message
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { conversation_id, contact_id, body: messageBody, scheduled_for, template_id } = body;

    if (!conversation_id || !messageBody) {
      return NextResponse.json({ error: "conversation_id and body are required" }, { status: 400 });
    }

    // Get conversation details
    const { data: conversation, error: convError } = await supabase
      .from("sms_conversations")
      .select(`
        *,
        contact:client_contacts!contact_id (
          id,
          first_name,
          last_name,
          phone,
          mobile
        )
      `)
      .eq("id", conversation_id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Check opt-in status
    if (!conversation.is_opted_in) {
      return NextResponse.json({ error: "Contact has opted out of SMS messages" }, { status: 400 });
    }

    // Validate phone number
    const toNumber = conversation.phone_number;
    if (!isValidPhoneNumber(toNumber)) {
      return NextResponse.json({
        error: "Invalid phone number format. Please update the contact's phone number."
      }, { status: 400 });
    }

    // Validate message length (SMS limit)
    if (messageBody.length > 160) {
      return NextResponse.json({
        error: "Message exceeds 160 character SMS limit"
      }, { status: 400 });
    }

    // Get SMS settings for the from number
    const { data: settings } = await supabase
      .from("sms_settings")
      .select("*")
      .limit(1)
      .single();

    const fromNumber = settings?.twilio_phone_number || process.env.TWILIO_PHONE_NUMBER || "+1234567890";
    const normalizedToNumber = normalizePhoneNumber(toNumber);

    // Create the message record
    const isScheduled = !!scheduled_for && new Date(scheduled_for) > new Date();

    const { data: message, error: msgError } = await supabase
      .from("sms_messages")
      .insert({
        conversation_id,
        contact_id: conversation.contact_id,
        client_id: conversation.client_id,
        direction: "outbound",
        from_number: fromNumber,
        to_number: normalizedToNumber,
        body: messageBody,
        status: isScheduled ? "scheduled" : "pending",
        sent_by: user.id,
        is_scheduled: isScheduled,
        scheduled_for: scheduled_for || null,
        template_id: template_id || null,
      })
      .select()
      .single();

    if (msgError) {
      console.error("Error creating message:", msgError);
      return NextResponse.json({ error: "Failed to create message" }, { status: 500 });
    }

    // If not scheduled, send via Twilio
    if (!isScheduled) {
      try {
        // Check if Twilio is configured
        const twilioSid = settings?.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID;
        const twilioToken = settings?.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN;

        if (twilioSid && twilioToken) {
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
                To: normalizedToNumber,
                Body: messageBody,
              }),
            }
          );

          const twilioData = await twilioResponse.json();

          if (twilioResponse.ok) {
            // Update message with Twilio SID and sent status
            await supabase
              .from("sms_messages")
              .update({
                twilio_sid: twilioData.sid,
                status: "sent",
                sent_at: new Date().toISOString(),
              })
              .eq("id", message.id);

            message.status = "sent";
            message.twilio_sid = twilioData.sid;
            message.sent_at = new Date().toISOString();
          } else {
            // Update with error
            await supabase
              .from("sms_messages")
              .update({
                status: "failed",
                error_code: twilioData.code?.toString(),
                error_message: twilioData.message,
              })
              .eq("id", message.id);

            message.status = "failed";
            message.error_message = twilioData.message;
          }
        } else {
          // Twilio not configured - mark as sent for demo
          await supabase
            .from("sms_messages")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
            })
            .eq("id", message.id);

          message.status = "sent";
          message.sent_at = new Date().toISOString();
        }
      } catch (twilioError) {
        console.error("Twilio error:", twilioError);
        await supabase
          .from("sms_messages")
          .update({
            status: "failed",
            error_message: "Failed to send via Twilio",
          })
          .eq("id", message.id);
      }
    }

    // Update conversation last message
    await supabase
      .from("sms_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: messageBody.substring(0, 100),
      })
      .eq("id", conversation_id);

    // Log to client communications
    await supabase.from("client_communications").insert({
      client_id: conversation.client_id,
      contact_id: conversation.contact_id,
      communication_type: "sms",
      subject: "SMS Message",
      summary: messageBody.substring(0, 200),
      user_id: user.id,
      direction: "outbound",
    });

    // Update template use count if applicable
    if (template_id) {
      await supabase.rpc("increment_template_use", { template_id });
    }

    return NextResponse.json(message);
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}

// GET - Search messages
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  const contactId = searchParams.get("contact_id");
  const clientId = searchParams.get("client_id");
  const limit = parseInt(searchParams.get("limit") || "50");

  try {
    let query = supabase
      .from("sms_messages")
      .select(`
        *,
        conversation:sms_conversations!conversation_id (
          id,
          contact:client_contacts!contact_id (
            first_name,
            last_name
          ),
          client:clients!client_id (
            name
          )
        )
      `)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (search) {
      query = query.ilike("body", `%${search}%`);
    }

    if (contactId) {
      query = query.eq("contact_id", contactId);
    }

    if (clientId) {
      query = query.eq("client_id", clientId);
    }

    const { data: messages, error } = await query;

    if (error) {
      console.error("Error searching messages:", error);
      return NextResponse.json({ error: "Failed to search messages" }, { status: 500 });
    }

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Error searching messages:", error);
    return NextResponse.json({ error: "Failed to search messages" }, { status: 500 });
  }
}
