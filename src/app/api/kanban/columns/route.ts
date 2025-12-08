import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - List all kanban columns
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { data: columns, error } = await supabase
      .from("kanban_columns")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Error fetching kanban columns:", error);
      return NextResponse.json({ error: "Failed to fetch columns" }, { status: 500 });
    }

    return NextResponse.json({ columns });
  } catch (error) {
    console.error("Error fetching kanban columns:", error);
    return NextResponse.json({ error: "Failed to fetch columns" }, { status: 500 });
  }
}

// POST - Create a new kanban column
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { label, icon, color } = body;

    if (!label) {
      return NextResponse.json({ error: "Label is required" }, { status: 400 });
    }

    // Generate code from label
    const code = label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

    // Get max sort_order
    const { data: maxOrder } = await supabase
      .from("kanban_columns")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();

    const newSortOrder = (maxOrder?.sort_order || 0) + 1;

    const { data: column, error } = await supabase
      .from("kanban_columns")
      .insert({
        code,
        label,
        icon: icon || "circle",
        color: color || "gray",
        sort_order: newSortOrder,
        is_default: false,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating kanban column:", error);
      if (error.code === "23505") {
        return NextResponse.json({ error: "Column with this name already exists" }, { status: 400 });
      }
      return NextResponse.json({ error: "Failed to create column" }, { status: 500 });
    }

    return NextResponse.json({ column });
  } catch (error) {
    console.error("Error creating kanban column:", error);
    return NextResponse.json({ error: "Failed to create column" }, { status: 500 });
  }
}

// PUT - Update column order (batch update)
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { columns } = body;

    if (!columns || !Array.isArray(columns)) {
      return NextResponse.json({ error: "Columns array is required" }, { status: 400 });
    }

    // Update each column's sort_order
    for (let i = 0; i < columns.length; i++) {
      const { error } = await supabase
        .from("kanban_columns")
        .update({ sort_order: i, updated_at: new Date().toISOString() })
        .eq("id", columns[i].id);

      if (error) {
        console.error("Error updating column order:", error);
        return NextResponse.json({ error: "Failed to update column order" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating column order:", error);
    return NextResponse.json({ error: "Failed to update column order" }, { status: 500 });
  }
}
