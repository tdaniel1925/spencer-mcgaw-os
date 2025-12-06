import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - List all auto-responders
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { data: autoResponders, error } = await supabase
      .from("sms_auto_responders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching auto-responders:", error);
      return NextResponse.json({ error: "Failed to fetch auto-responders" }, { status: 500 });
    }

    return NextResponse.json({ autoResponders });
  } catch (error) {
    console.error("Error fetching auto-responders:", error);
    return NextResponse.json({ error: "Failed to fetch auto-responders" }, { status: 500 });
  }
}

// POST - Create a new auto-responder
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, trigger_type, trigger_keywords, response_message, is_active } = body;

    if (!name || !trigger_type || !response_message) {
      return NextResponse.json(
        { error: "Name, trigger type, and response message are required" },
        { status: 400 }
      );
    }

    const { data: autoResponder, error } = await supabase
      .from("sms_auto_responders")
      .insert({
        name,
        trigger_type,
        trigger_keywords: trigger_keywords || [],
        response_message,
        is_active: is_active ?? true,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating auto-responder:", error);
      return NextResponse.json({ error: "Failed to create auto-responder" }, { status: 500 });
    }

    return NextResponse.json(autoResponder);
  } catch (error) {
    console.error("Error creating auto-responder:", error);
    return NextResponse.json({ error: "Failed to create auto-responder" }, { status: 500 });
  }
}
