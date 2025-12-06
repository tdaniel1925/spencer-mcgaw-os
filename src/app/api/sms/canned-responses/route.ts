import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - List all canned responses
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search");

  try {
    let query = supabase
      .from("sms_canned_responses")
      .select("*")
      .order("shortcut", { ascending: true });

    if (category) {
      query = query.eq("category", category);
    }

    if (search) {
      query = query.or(`shortcut.ilike.%${search}%,title.ilike.%${search}%,body.ilike.%${search}%`);
    }

    const { data: responses, error } = await query;

    if (error) {
      console.error("Error fetching canned responses:", error);
      return NextResponse.json({ error: "Failed to fetch canned responses" }, { status: 500 });
    }

    return NextResponse.json({ responses });
  } catch (error) {
    console.error("Error fetching canned responses:", error);
    return NextResponse.json({ error: "Failed to fetch canned responses" }, { status: 500 });
  }
}

// POST - Create new canned response
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { shortcut, title, body: responseBody, category } = body;

    if (!shortcut || !title || !responseBody) {
      return NextResponse.json({ error: "shortcut, title, and body are required" }, { status: 400 });
    }

    // Ensure shortcut starts with /
    const normalizedShortcut = shortcut.startsWith("/") ? shortcut : `/${shortcut}`;

    const { data: response, error } = await supabase
      .from("sms_canned_responses")
      .insert({
        shortcut: normalizedShortcut,
        title,
        body: responseBody,
        category: category || "general",
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Shortcut already exists" }, { status: 400 });
      }
      console.error("Error creating canned response:", error);
      return NextResponse.json({ error: "Failed to create canned response" }, { status: 500 });
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error creating canned response:", error);
    return NextResponse.json({ error: "Failed to create canned response" }, { status: 500 });
  }
}
