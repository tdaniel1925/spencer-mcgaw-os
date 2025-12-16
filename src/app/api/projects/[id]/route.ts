import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - Get single project with tasks
export async function GET(
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
    // Get project with related data
    const { data: project, error } = await supabase
      .from("projects")
      .select(`
        *,
        client:clients(id, name, email, phone),
        assigned_user:users!projects_assigned_to_fkey(id, email, full_name),
        reviewer:users!projects_reviewer_id_fkey(id, email, full_name),
        partner:users!projects_partner_id_fkey(id, email, full_name),
        template:project_templates(id, name, project_type)
      `)
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get project tasks
    const { data: tasks } = await supabase
      .from("project_tasks")
      .select(`
        *,
        assigned_user:users!project_tasks_assigned_to_fkey(id, email, full_name)
      `)
      .eq("project_id", id)
      .order("sort_order");

    // Get project notes
    const { data: notes } = await supabase
      .from("project_notes")
      .select(`
        *,
        user:users!project_notes_user_id_fkey(id, email, full_name)
      `)
      .eq("project_id", id)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      project,
      tasks: tasks || [],
      notes: notes || [],
    });
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 });
  }
}

// PATCH - Update project
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
    const updates: Record<string, unknown> = {};

    // Only include fields that are provided
    const allowedFields = [
      "name", "status", "project_type", "tax_year",
      "period_start", "period_end", "due_date", "extension_date",
      "internal_deadline", "assigned_to", "reviewer_id", "partner_id",
      "progress_percent", "notes", "started_at", "completed_at",
      "is_recurring", "recurrence_pattern"
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // Auto-set started_at when status changes to in_progress
    if (body.status === "in_progress" && !body.started_at) {
      updates.started_at = new Date().toISOString();
    }

    // Auto-set completed_at when status changes to completed
    if (body.status === "completed" && !body.completed_at) {
      updates.completed_at = new Date().toISOString();
      updates.progress_percent = 100;
    }

    updates.updated_at = new Date().toISOString();

    const { data: project, error } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", id)
      .select(`
        *,
        client:clients(id, name),
        assigned_user:users!projects_assigned_to_fkey(id, email, full_name)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ project });
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

// DELETE - Delete project
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
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
