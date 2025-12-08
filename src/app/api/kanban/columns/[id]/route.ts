import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PATCH - Update a kanban column
export async function PATCH(
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
    const body = await request.json();
    const { label, icon, color, is_active } = body;

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (label !== undefined) updateData.label = label;
    if (icon !== undefined) updateData.icon = icon;
    if (color !== undefined) updateData.color = color;
    if (is_active !== undefined) updateData.is_active = is_active;

    // If updating label, also update code
    if (label) {
      updateData.code = label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    }

    const { data: column, error } = await supabase
      .from("kanban_columns")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating kanban column:", error);
      return NextResponse.json({ error: "Failed to update column" }, { status: 500 });
    }

    return NextResponse.json({ column });
  } catch (error) {
    console.error("Error updating kanban column:", error);
    return NextResponse.json({ error: "Failed to update column" }, { status: 500 });
  }
}

// DELETE - Delete (deactivate) a kanban column
export async function DELETE(
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
    // Check if column is default - don't allow deleting defaults
    const { data: column } = await supabase
      .from("kanban_columns")
      .select("is_default, code")
      .eq("id", id)
      .single();

    if (column?.is_default) {
      return NextResponse.json({ error: "Cannot delete default columns" }, { status: 400 });
    }

    // Check if there are tasks in this status
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id")
      .eq("status", column?.code)
      .limit(1);

    if (tasks && tasks.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete column with active tasks. Move tasks first." },
        { status: 400 }
      );
    }

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from("kanban_columns")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error("Error deleting kanban column:", error);
      return NextResponse.json({ error: "Failed to delete column" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting kanban column:", error);
    return NextResponse.json({ error: "Failed to delete column" }, { status: 500 });
  }
}
