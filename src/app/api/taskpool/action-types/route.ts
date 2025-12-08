import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/constants";

// GET - List all action types
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { data: actionTypes, error } = await supabase
      .from("task_action_types")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Error fetching action types:", error);
      return NextResponse.json({ error: "Failed to fetch action types" }, { status: 500 });
    }

    return NextResponse.json({ actionTypes });
  } catch (error) {
    console.error("Error fetching action types:", error);
    return NextResponse.json({ error: "Failed to fetch action types" }, { status: 500 });
  }
}

// POST - Create a new action type (admin only)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { code, label, description, color, icon, sort_order } = body;

    if (!code || !label) {
      return NextResponse.json(
        { error: "Code and label are required" },
        { status: 400 }
      );
    }

    const { data: actionType, error } = await supabase
      .from("task_action_types")
      .insert({
        code: code.toUpperCase(),
        label,
        description,
        color: color || "#6B7280",
        icon: icon || "clipboard",
        sort_order: sort_order || 0,
        organization_id: DEFAULT_ORGANIZATION_ID,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating action type:", error);
      return NextResponse.json({ error: "Failed to create action type" }, { status: 500 });
    }

    return NextResponse.json(actionType);
  } catch (error) {
    console.error("Error creating action type:", error);
    return NextResponse.json({ error: "Failed to create action type" }, { status: 500 });
  }
}
