import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ReportType = "clients" | "projects" | "tasks" | "tax-filings" | "communications" | "workload";

interface ReportOptions {
  type: ReportType;
  format: "csv" | "json";
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  taxYear?: number;
  assignedTo?: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const reportType = searchParams.get("type") as ReportType;
  const format = (searchParams.get("format") || "csv") as "csv" | "json";
  const dateFrom = searchParams.get("dateFrom") || undefined;
  const dateTo = searchParams.get("dateTo") || undefined;
  const status = searchParams.get("status") || undefined;
  const taxYear = searchParams.get("taxYear") ? parseInt(searchParams.get("taxYear")!) : undefined;
  const assignedTo = searchParams.get("assignedTo") || undefined;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Check if user has permission to export (owner, admin, or manager)
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const allowedRoles = ["owner", "admin", "manager"];
  if (!profile || !allowedRoles.includes(profile.role)) {
    return NextResponse.json({ error: "Permission denied. Only managers and above can export reports." }, { status: 403 });
  }

  if (!reportType) {
    return NextResponse.json({ error: "Report type is required" }, { status: 400 });
  }

  const options: ReportOptions = {
    type: reportType,
    format,
    dateFrom,
    dateTo,
    status,
    taxYear,
    assignedTo,
  };

  try {
    let data: Record<string, unknown>[] = [];
    let filename = "";

    switch (reportType) {
      case "clients":
        data = await generateClientReport(supabase, options);
        filename = "clients-report";
        break;
      case "projects":
        data = await generateProjectReport(supabase, options);
        filename = "projects-report";
        break;
      case "tasks":
        data = await generateTaskReport(supabase, options);
        filename = "tasks-report";
        break;
      case "tax-filings":
        data = await generateTaxFilingReport(supabase, options);
        filename = "tax-filings-report";
        break;
      case "communications":
        data = await generateCommunicationsReport(supabase, options);
        filename = "communications-report";
        break;
      case "workload":
        data = await generateWorkloadReport(supabase, options);
        filename = "workload-report";
        break;
      default:
        return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
    }

    const timestamp = new Date().toISOString().split("T")[0];
    filename = `${filename}-${timestamp}`;

    if (format === "json") {
      return NextResponse.json({ data, filename: `${filename}.json` });
    }

    // Generate CSV
    const csv = convertToCSV(data);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateClientReport(supabase: any, options: ReportOptions) {
  let query = supabase
    .from("clients")
    .select(`
      id,
      name,
      email,
      phone,
      address,
      city,
      state,
      zip,
      status,
      entity_type,
      ein,
      notes,
      tags,
      created_at,
      updated_at
    `)
    .order("name");

  if (options.status) {
    query = query.eq("status", options.status);
  }

  if (options.dateFrom) {
    query = query.gte("created_at", options.dateFrom);
  }

  if (options.dateTo) {
    query = query.lte("created_at", options.dateTo);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((client: Record<string, unknown>) => ({
    "Client ID": client.id,
    "Name": client.name,
    "Email": client.email || "",
    "Phone": client.phone || "",
    "Address": client.address || "",
    "City": client.city || "",
    "State": client.state || "",
    "ZIP": client.zip || "",
    "Status": client.status,
    "Entity Type": client.entity_type || "",
    "EIN": client.ein || "",
    "Notes": client.notes || "",
    "Tags": Array.isArray(client.tags) ? client.tags.join(", ") : "",
    "Created At": formatDate(client.created_at as string),
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateProjectReport(supabase: any, options: ReportOptions) {
  let query = supabase
    .from("projects")
    .select(`
      id,
      name,
      project_type,
      status,
      tax_year,
      due_date,
      extension_date,
      internal_deadline,
      progress_percent,
      started_at,
      completed_at,
      created_at,
      client:clients(name),
      assigned_user:user_profiles!projects_assigned_to_fkey(full_name, email),
      reviewer:user_profiles!projects_reviewer_id_fkey(full_name)
    `)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (options.status) {
    query = query.eq("status", options.status);
  }

  if (options.taxYear) {
    query = query.eq("tax_year", options.taxYear);
  }

  if (options.assignedTo) {
    query = query.eq("assigned_to", options.assignedTo);
  }

  if (options.dateFrom) {
    query = query.gte("created_at", options.dateFrom);
  }

  if (options.dateTo) {
    query = query.lte("created_at", options.dateTo);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((project: Record<string, unknown>) => ({
    "Project ID": project.id,
    "Project Name": project.name,
    "Client": (project.client as Record<string, unknown>)?.name || "",
    "Type": project.project_type,
    "Status": project.status,
    "Tax Year": project.tax_year || "",
    "Due Date": formatDate(project.due_date as string),
    "Extension Date": formatDate(project.extension_date as string),
    "Internal Deadline": formatDate(project.internal_deadline as string),
    "Progress %": project.progress_percent || 0,
    "Assigned To": (project.assigned_user as Record<string, unknown>)?.full_name || "",
    "Reviewer": (project.reviewer as Record<string, unknown>)?.full_name || "",
    "Started At": formatDate(project.started_at as string),
    "Completed At": formatDate(project.completed_at as string),
    "Created At": formatDate(project.created_at as string),
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateTaskReport(supabase: any, options: ReportOptions) {
  let query = supabase
    .from("tasks")
    .select(`
      id,
      title,
      description,
      status,
      priority,
      due_date,
      completed_at,
      created_at,
      source,
      assigned_user:user_profiles!tasks_assigned_to_fkey(full_name, email),
      client:clients(name)
    `)
    .order("created_at", { ascending: false });

  if (options.status) {
    query = query.eq("status", options.status);
  }

  if (options.assignedTo) {
    query = query.eq("assigned_to", options.assignedTo);
  }

  if (options.dateFrom) {
    query = query.gte("created_at", options.dateFrom);
  }

  if (options.dateTo) {
    query = query.lte("created_at", options.dateTo);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((task: Record<string, unknown>) => ({
    "Task ID": task.id,
    "Title": task.title,
    "Description": task.description || "",
    "Status": task.status,
    "Priority": task.priority,
    "Due Date": formatDate(task.due_date as string),
    "Assigned To": (task.assigned_user as Record<string, unknown>)?.full_name || "Unassigned",
    "Client": (task.client as Record<string, unknown>)?.name || "",
    "Source": task.source || "",
    "Completed At": formatDate(task.completed_at as string),
    "Created At": formatDate(task.created_at as string),
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateTaxFilingReport(supabase: any, options: ReportOptions) {
  let query = supabase
    .from("client_tax_filings")
    .select(`
      id,
      tax_year,
      form_type,
      status,
      due_date,
      extended_due_date,
      filed_date,
      refund_amount,
      amount_due,
      created_at,
      client:clients(name, ein)
    `)
    .order("tax_year", { ascending: false })
    .order("due_date", { ascending: true });

  if (options.status) {
    query = query.eq("status", options.status);
  }

  if (options.taxYear) {
    query = query.eq("tax_year", options.taxYear);
  }

  if (options.dateFrom) {
    query = query.gte("created_at", options.dateFrom);
  }

  if (options.dateTo) {
    query = query.lte("created_at", options.dateTo);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((filing: Record<string, unknown>) => ({
    "Filing ID": filing.id,
    "Client": (filing.client as Record<string, unknown>)?.name || "",
    "Client EIN": (filing.client as Record<string, unknown>)?.ein || "",
    "Tax Year": filing.tax_year,
    "Form Type": filing.form_type,
    "Status": filing.status,
    "Due Date": formatDate(filing.due_date as string),
    "Extended Due Date": formatDate(filing.extended_due_date as string),
    "Filed Date": formatDate(filing.filed_date as string),
    "Refund Amount": filing.refund_amount || "",
    "Amount Due": filing.amount_due || "",
    "Created At": formatDate(filing.created_at as string),
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateCommunicationsReport(supabase: any, options: ReportOptions) {
  // Get calls
  let callsQuery = supabase
    .from("call_events")
    .select(`
      id,
      direction,
      caller_number,
      dialed_number,
      status,
      call_created_at,
      call_answered_at,
      call_ended_at,
      duration_seconds,
      user_name,
      line_name,
      has_recording,
      client:clients(name)
    `)
    .order("call_created_at", { ascending: false });

  if (options.dateFrom) {
    callsQuery = callsQuery.gte("call_created_at", options.dateFrom);
  }

  if (options.dateTo) {
    callsQuery = callsQuery.lte("call_created_at", options.dateTo);
  }

  const { data: calls, error: callsError } = await callsQuery;
  if (callsError) throw callsError;

  // Get emails
  let emailsQuery = supabase
    .from("email_classifications")
    .select(`
      id,
      email_from,
      email_to,
      subject,
      category,
      priority,
      sentiment,
      created_at,
      client:clients(name)
    `)
    .order("created_at", { ascending: false });

  if (options.dateFrom) {
    emailsQuery = emailsQuery.gte("created_at", options.dateFrom);
  }

  if (options.dateTo) {
    emailsQuery = emailsQuery.lte("created_at", options.dateTo);
  }

  const { data: emails, error: emailsError } = await emailsQuery;
  if (emailsError) throw emailsError;

  // Combine and format
  const callData = (calls || []).map((call: Record<string, unknown>) => ({
    "Type": "Call",
    "Date": formatDateTime(call.call_created_at as string),
    "Direction": call.direction,
    "From": call.caller_number || "",
    "To": call.dialed_number || "",
    "Subject/Status": call.status,
    "Client": (call.client as Record<string, unknown>)?.name || "",
    "User": call.user_name || "",
    "Duration (sec)": call.duration_seconds || "",
    "Has Recording": call.has_recording ? "Yes" : "No",
    "Category": "",
    "Priority": "",
  }));

  const emailData = (emails || []).map((email: Record<string, unknown>) => ({
    "Type": "Email",
    "Date": formatDateTime(email.created_at as string),
    "Direction": "inbound",
    "From": email.email_from || "",
    "To": email.email_to || "",
    "Subject/Status": email.subject || "",
    "Client": (email.client as Record<string, unknown>)?.name || "",
    "User": "",
    "Duration (sec)": "",
    "Has Recording": "",
    "Category": email.category || "",
    "Priority": email.priority || "",
  }));

  return [...callData, ...emailData].sort((a, b) => {
    const dateA = new Date(a["Date"] || 0);
    const dateB = new Date(b["Date"] || 0);
    return dateB.getTime() - dateA.getTime();
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateWorkloadReport(supabase: any, options: ReportOptions) {
  // Get all users
  const { data: users, error: usersError } = await supabase
    .from("user_profiles")
    .select("id, full_name, email, role")
    .order("full_name");

  if (usersError) throw usersError;

  // Get task counts per user
  const workloadData = [];

  for (const user of users || []) {
    let taskQuery = supabase
      .from("tasks")
      .select("id, status", { count: "exact" })
      .eq("assigned_to", user.id);

    if (options.dateFrom) {
      taskQuery = taskQuery.gte("created_at", options.dateFrom);
    }

    if (options.dateTo) {
      taskQuery = taskQuery.lte("created_at", options.dateTo);
    }

    const { data: tasks } = await taskQuery;

    const pending = tasks?.filter((t: { status: string }) => t.status === "pending").length || 0;
    const inProgress = tasks?.filter((t: { status: string }) => t.status === "in_progress").length || 0;
    const completed = tasks?.filter((t: { status: string }) => t.status === "completed").length || 0;
    const total = tasks?.length || 0;

    // Get project counts
    const { data: projects } = await supabase
      .from("projects")
      .select("id, status")
      .eq("assigned_to", user.id);

    const activeProjects = projects?.filter((p: { status: string }) =>
      p.status === "in_progress" || p.status === "not_started"
    ).length || 0;

    workloadData.push({
      "User ID": user.id,
      "Name": user.full_name || user.email,
      "Email": user.email,
      "Role": user.role,
      "Total Tasks": total,
      "Pending Tasks": pending,
      "In Progress Tasks": inProgress,
      "Completed Tasks": completed,
      "Completion Rate %": total > 0 ? Math.round((completed / total) * 100) : 0,
      "Active Projects": activeProjects,
    });
  }

  return workloadData;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function convertToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "";

  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(",")];

  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      // Handle strings with commas, quotes, or newlines
      if (typeof value === "string") {
        const escaped = value.replace(/"/g, '""');
        if (escaped.includes(",") || escaped.includes('"') || escaped.includes("\n")) {
          return `"${escaped}"`;
        }
        return escaped;
      }
      return value ?? "";
    });
    csvRows.push(values.join(","));
  }

  return csvRows.join("\n");
}
