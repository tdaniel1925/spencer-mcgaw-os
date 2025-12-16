import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - List all projects
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("client_id");
  const status = searchParams.get("status");
  const assignedTo = searchParams.get("assigned_to");
  const taxYear = searchParams.get("tax_year");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    let query = supabase
      .from("projects")
      .select(`
        *,
        client:clients(id, name, email, phone),
        assigned_user:users!projects_assigned_to_fkey(id, email, full_name),
        reviewer:users!projects_reviewer_id_fkey(id, email, full_name),
        template:project_templates(id, name, project_type)
      `, { count: "exact" });

    // Apply filters
    if (clientId) {
      query = query.eq("client_id", clientId);
    }

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (assignedTo) {
      query = query.eq("assigned_to", assignedTo);
    }

    if (taxYear) {
      query = query.eq("tax_year", parseInt(taxYear));
    }

    const { data: projects, error, count } = await query
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({
      projects: projects || [],
      count: count || 0,
    });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

// POST - Create a new project
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      client_id,
      template_id,
      name,
      project_type,
      tax_year,
      period_start,
      period_end,
      due_date,
      extension_date,
      internal_deadline,
      assigned_to,
      reviewer_id,
      partner_id,
      notes,
      is_recurring,
      recurrence_pattern,
    } = body;

    if (!client_id || !name || !project_type) {
      return NextResponse.json(
        { error: "client_id, name, and project_type are required" },
        { status: 400 }
      );
    }

    // Insert project
    const { data: project, error } = await supabase
      .from("projects")
      .insert({
        client_id,
        template_id,
        name,
        project_type,
        status: "not_started",
        tax_year,
        period_start,
        period_end,
        due_date,
        extension_date,
        internal_deadline,
        assigned_to,
        reviewer_id,
        partner_id,
        notes,
        is_recurring: is_recurring || false,
        recurrence_pattern,
        created_by: user.id,
        progress_percent: 0,
      })
      .select(`
        *,
        client:clients(id, name),
        assigned_user:users!projects_assigned_to_fkey(id, email, full_name)
      `)
      .single();

    if (error) throw error;

    // If template is provided, create tasks from template
    if (template_id) {
      const { data: templateTasks } = await supabase
        .from("project_template_tasks")
        .select("*")
        .eq("template_id", template_id)
        .order("sort_order");

      if (templateTasks && templateTasks.length > 0) {
        const startDate = new Date(period_start || due_date || new Date());

        const projectTasks = templateTasks.map((task) => ({
          project_id: project.id,
          template_task_id: task.id,
          title: task.title,
          description: task.description,
          task_type: task.task_type,
          sort_order: task.sort_order,
          estimated_hours: task.estimated_hours,
          due_date: task.days_from_start
            ? new Date(startDate.getTime() + task.days_from_start * 24 * 60 * 60 * 1000).toISOString()
            : null,
          status: "pending",
        }));

        await supabase.from("project_tasks").insert(projectTasks);
      }
    }

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
