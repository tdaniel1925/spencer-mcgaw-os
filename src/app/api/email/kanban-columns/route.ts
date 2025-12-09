import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  order: number;
}

// Default columns if none configured
const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: "pending", title: "New", color: "bg-blue-500", order: 0 },
  { id: "waiting", title: "Waiting on Client", color: "bg-amber-500", order: 1 },
  { id: "in_progress", title: "In Progress", color: "bg-violet-500", order: 2 },
  { id: "completed", title: "Completed", color: "bg-emerald-500", order: 3 },
];

// Get kanban column configuration
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Try to get from app_settings table
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "email_kanban_columns")
      .single();

    if (error || !data) {
      // Return default columns if not configured
      return NextResponse.json({ columns: DEFAULT_COLUMNS });
    }

    return NextResponse.json({ columns: data.value });
  } catch (error) {
    console.error("Get kanban columns error:", error);
    // Return defaults on any error
    return NextResponse.json({ columns: DEFAULT_COLUMNS });
  }
}

// Update kanban column configuration (admin only)
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const adminEmails = ["tdaniel@botmakers.ai"];
  const isAdmin = profile?.role === "admin" ||
                  profile?.role === "owner" ||
                  adminEmails.includes(user.email || "");

  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { columns } = body;

    if (!columns || !Array.isArray(columns)) {
      return NextResponse.json({ error: "Invalid columns data" }, { status: 400 });
    }

    // Validate columns structure
    for (const col of columns) {
      if (!col.id || !col.title || !col.color || typeof col.order !== "number") {
        return NextResponse.json({ error: "Invalid column structure" }, { status: 400 });
      }
    }

    // Upsert the configuration
    const { error } = await supabase
      .from("app_settings")
      .upsert({
        key: "email_kanban_columns",
        value: columns,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      }, {
        onConflict: "key",
      });

    if (error) {
      console.error("Error saving kanban columns:", error);
      return NextResponse.json({ error: "Failed to save columns" }, { status: 500 });
    }

    return NextResponse.json({ success: true, columns });
  } catch (error) {
    console.error("Update kanban columns error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Reset to default columns (admin only)
export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const adminEmails = ["tdaniel@botmakers.ai"];
  const isAdmin = profile?.role === "admin" ||
                  profile?.role === "owner" ||
                  adminEmails.includes(user.email || "");

  if (!isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    // Delete the custom configuration (will fall back to defaults)
    await supabase
      .from("app_settings")
      .delete()
      .eq("key", "email_kanban_columns");

    return NextResponse.json({ success: true, columns: DEFAULT_COLUMNS });
  } catch (error) {
    console.error("Reset kanban columns error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
