import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - Get SMS settings
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { data: settings, error } = await supabase
      .from("sms_settings")
      .select("*")
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching settings:", error);
      return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
    }

    // Return default settings if none exist
    if (!settings) {
      return NextResponse.json({
        company_name: "",
        default_sender_name: "",
        business_hours_start: "09:00",
        business_hours_end: "17:00",
        business_days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
        timezone: "America/New_York",
        auto_reply_enabled: false,
        after_hours_message: "",
        opt_out_message: "You have been unsubscribed. Reply START to resubscribe.",
        opt_in_confirmation: "You are now subscribed. Reply STOP to unsubscribe.",
        max_messages_per_day: 10,
        require_opt_in: false,
        twilio_account_sid: "",
        twilio_auth_token: "",
        twilio_phone_number: "",
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

// PUT - Update SMS settings
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Check if settings exist
    const { data: existing } = await supabase
      .from("sms_settings")
      .select("id")
      .single();

    let result;
    if (existing) {
      // Update existing settings
      result = await supabase
        .from("sms_settings")
        .update(body)
        .eq("id", existing.id)
        .select()
        .single();
    } else {
      // Insert new settings
      result = await supabase
        .from("sms_settings")
        .insert(body)
        .select()
        .single();
    }

    if (result.error) {
      console.error("Error saving settings:", result.error);
      return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Error saving settings:", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
