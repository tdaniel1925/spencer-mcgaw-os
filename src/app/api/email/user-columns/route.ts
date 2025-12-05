/**
 * User-Specific Email Kanban Columns API
 *
 * Allows users to customize their own Kanban column layout
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Default columns for new users
const DEFAULT_COLUMNS = [
  { columnId: "pending", title: "Inbox", color: "bg-blue-500", icon: "Inbox", position: 0, isDefault: true },
  { columnId: "in_progress", title: "Working On", color: "bg-violet-500", icon: "Clock", position: 1, isDefault: false },
  { columnId: "waiting", title: "Waiting", color: "bg-amber-500", icon: "Hourglass", position: 2, isDefault: false },
  { columnId: "completed", title: "Done", color: "bg-emerald-500", icon: "CheckCircle", position: 3, isDefault: false },
];

export interface UserColumn {
  id: string;
  columnId: string;
  title: string;
  color: string;
  icon?: string;
  position: number;
  isDefault: boolean;
  isVisible: boolean;
  autoCompleteAfterDays?: number;
  autoArchiveAfterDays?: number;
}

// Get user's columns
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || user.id;

    // Get user's custom columns
    const { data: columns, error } = await supabase
      .from("email_user_columns")
      .select("*")
      .eq("user_id", userId)
      .order("position", { ascending: true });

    if (error) {
      throw error;
    }

    // If user has no custom columns, return defaults
    if (!columns || columns.length === 0) {
      return NextResponse.json({
        success: true,
        columns: DEFAULT_COLUMNS.map((col, idx) => ({
          id: `default-${col.columnId}`,
          ...col,
          isVisible: true,
        })),
        isDefault: true,
      });
    }

    const formattedColumns: UserColumn[] = columns.map((col) => ({
      id: col.id,
      columnId: col.column_id,
      title: col.title,
      color: col.color,
      icon: col.icon,
      position: col.position,
      isDefault: col.is_default,
      isVisible: col.is_visible,
      autoCompleteAfterDays: col.auto_complete_after_days,
      autoArchiveAfterDays: col.auto_archive_after_days,
    }));

    return NextResponse.json({
      success: true,
      columns: formattedColumns,
      isDefault: false,
    });
  } catch (error) {
    console.error("[User Columns API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch columns" },
      { status: 500 }
    );
  }
}

// Create/update user's columns
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { columns } = body as { columns: Partial<UserColumn>[] };

    if (!columns || !Array.isArray(columns)) {
      return NextResponse.json(
        { error: "Columns array required" },
        { status: 400 }
      );
    }

    // Validate columns
    for (const col of columns) {
      if (!col.columnId || !col.title) {
        return NextResponse.json(
          { error: "Each column must have columnId and title" },
          { status: 400 }
        );
      }
    }

    // Delete existing columns for user
    await supabase
      .from("email_user_columns")
      .delete()
      .eq("user_id", user.id);

    // Insert new columns
    const columnsToInsert = columns.map((col, idx) => ({
      user_id: user.id,
      column_id: col.columnId,
      title: col.title,
      color: col.color || "bg-gray-500",
      icon: col.icon,
      position: col.position ?? idx,
      is_default: col.isDefault || idx === 0,
      is_visible: col.isVisible !== false,
      auto_complete_after_days: col.autoCompleteAfterDays,
      auto_archive_after_days: col.autoArchiveAfterDays,
    }));

    const { data: inserted, error } = await supabase
      .from("email_user_columns")
      .insert(columnsToInsert)
      .select();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      columns: inserted,
    });
  } catch (error) {
    console.error("[User Columns API] Error saving columns:", error);
    return NextResponse.json(
      { error: "Failed to save columns" },
      { status: 500 }
    );
  }
}

// Update a single column
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      id,
      columnId,
      title,
      color,
      icon,
      position,
      isDefault,
      isVisible,
      autoCompleteAfterDays,
      autoArchiveAfterDays,
    } = body;

    if (!id && !columnId) {
      return NextResponse.json(
        { error: "Column ID required" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) updateData.title = title;
    if (color !== undefined) updateData.color = color;
    if (icon !== undefined) updateData.icon = icon;
    if (position !== undefined) updateData.position = position;
    if (isDefault !== undefined) updateData.is_default = isDefault;
    if (isVisible !== undefined) updateData.is_visible = isVisible;
    if (autoCompleteAfterDays !== undefined) updateData.auto_complete_after_days = autoCompleteAfterDays;
    if (autoArchiveAfterDays !== undefined) updateData.auto_archive_after_days = autoArchiveAfterDays;

    let query = supabase
      .from("email_user_columns")
      .update(updateData)
      .eq("user_id", user.id);

    if (id) {
      query = query.eq("id", id);
    } else {
      query = query.eq("column_id", columnId);
    }

    const { error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[User Columns API] Error updating column:", error);
    return NextResponse.json(
      { error: "Failed to update column" },
      { status: 500 }
    );
  }
}

// Delete a column (or reset to defaults)
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const columnId = searchParams.get("columnId");
    const resetToDefault = searchParams.get("reset") === "true";

    if (resetToDefault) {
      // Delete all user columns (will fall back to defaults)
      await supabase
        .from("email_user_columns")
        .delete()
        .eq("user_id", user.id);

      return NextResponse.json({
        success: true,
        columns: DEFAULT_COLUMNS,
      });
    }

    if (!columnId) {
      return NextResponse.json(
        { error: "Column ID required" },
        { status: 400 }
      );
    }

    // Delete specific column
    await supabase
      .from("email_user_columns")
      .delete()
      .eq("user_id", user.id)
      .eq("column_id", columnId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[User Columns API] Error deleting column:", error);
    return NextResponse.json(
      { error: "Failed to delete column" },
      { status: 500 }
    );
  }
}

// Add a new column for user
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { columnId, title, color, icon } = body;

    if (!columnId || !title) {
      return NextResponse.json(
        { error: "columnId and title required" },
        { status: 400 }
      );
    }

    // Get max position
    const { data: existing } = await supabase
      .from("email_user_columns")
      .select("position")
      .eq("user_id", user.id)
      .order("position", { ascending: false })
      .limit(1);

    const maxPosition = existing?.[0]?.position ?? -1;

    // Check if user has any columns, if not, initialize with defaults first
    if (!existing || existing.length === 0) {
      const defaultColumnsToInsert = DEFAULT_COLUMNS.map((col, idx) => ({
        user_id: user.id,
        column_id: col.columnId,
        title: col.title,
        color: col.color,
        icon: col.icon,
        position: idx,
        is_default: col.isDefault,
        is_visible: true,
      }));

      await supabase
        .from("email_user_columns")
        .insert(defaultColumnsToInsert);
    }

    // Add the new column
    const { data, error } = await supabase
      .from("email_user_columns")
      .insert({
        user_id: user.id,
        column_id: columnId,
        title,
        color: color || "bg-gray-500",
        icon,
        position: maxPosition + 1,
        is_default: false,
        is_visible: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Column already exists" },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      column: {
        id: data.id,
        columnId: data.column_id,
        title: data.title,
        color: data.color,
        icon: data.icon,
        position: data.position,
        isDefault: data.is_default,
        isVisible: data.is_visible,
      },
    });
  } catch (error) {
    console.error("[User Columns API] Error adding column:", error);
    return NextResponse.json(
      { error: "Failed to add column" },
      { status: 500 }
    );
  }
}
