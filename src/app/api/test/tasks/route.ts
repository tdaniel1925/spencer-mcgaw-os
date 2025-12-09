import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Sample data for generating realistic test tasks
const emailScenarios = [
  { subject: "Tax documents for Q4 review", client: "Johnson Family Trust", priority: "high" as const },
  { subject: "W-2 corrections needed", client: "ABC Manufacturing", priority: "urgent" as const },
  { subject: "Payroll discrepancy question", client: "Smith & Associates", priority: "medium" as const },
  { subject: "1099 filing deadline reminder", client: "Tech Startup Inc", priority: "high" as const },
  { subject: "QuickBooks sync issue", client: "Downtown Retail LLC", priority: "low" as const },
  { subject: "Monthly reconciliation request", client: "Green Energy Corp", priority: "medium" as const },
  { subject: "Audit preparation documents", client: "Healthcare Partners", priority: "urgent" as const },
  { subject: "Expense report clarification", client: "Marketing Agency Pro", priority: "low" as const },
  { subject: "Year-end closing questions", client: "Family Restaurant Group", priority: "high" as const },
  { subject: "Sales tax calculation help", client: "E-commerce Solutions", priority: "medium" as const },
  { subject: "Inventory valuation review", client: "Wholesale Distributors", priority: "medium" as const },
  { subject: "Bank statement discrepancy", client: "Real Estate Holdings", priority: "high" as const },
];

const phoneCallScenarios = [
  { subject: "Client needs urgent tax filing extension", client: "Peterson Industries", priority: "urgent" as const },
  { subject: "Follow-up on missing receipts", client: "Creative Design Studio", priority: "medium" as const },
  { subject: "Schedule quarterly review meeting", client: "Legal Associates LLP", priority: "low" as const },
  { subject: "Discuss payroll changes for new hires", client: "Growing Startup Co", priority: "medium" as const },
  { subject: "Address IRS notice received", client: "Family Dental Practice", priority: "urgent" as const },
  { subject: "Review profit sharing options", client: "Construction Partners", priority: "high" as const },
  { subject: "Update business entity structure", client: "Investment Group LLC", priority: "high" as const },
  { subject: "Clarify depreciation schedule", client: "Manufacturing Plus", priority: "medium" as const },
  { subject: "Discuss estimated tax payments", client: "Freelance Consultants", priority: "medium" as const },
  { subject: "Review retirement plan contributions", client: "Medical Practice Group", priority: "high" as const },
];

const descriptions = [
  "Client requested immediate attention on this matter. Please review and respond within 24 hours.",
  "Follow-up from previous conversation. Documents have been uploaded to the portal.",
  "New request - client is waiting for confirmation before proceeding.",
  "Routine task - can be handled during normal workflow.",
  "Time-sensitive - deadline approaching. Please prioritize.",
  "Client has questions about recent changes. May need a call to discuss.",
  "Documentation incomplete - need to request additional information from client.",
  "Ready for processing - all required documents received.",
];

function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function generateTestTask() {
  const isEmail = Math.random() > 0.4; // 60% emails, 40% phone calls
  const scenario = isEmail
    ? getRandomItem(emailScenarios)
    : getRandomItem(phoneCallScenarios);

  const sourceType = isEmail ? "email" : "phone_call";
  const testId = `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  return {
    title: scenario.subject,
    description: getRandomItem(descriptions),
    status: "pending" as const,
    priority: scenario.priority,
    source_type: sourceType,
    source_email_id: testId,
    client_id: null,
    assigned_to: null,
    due_date: null,
  };
}

// POST - Generate a new test task
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Check if user is admin or owner
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "owner"].includes(profile.role)) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const count = Math.min(body.count || 1, 10); // Max 10 tasks at once

    const tasks = [];
    for (let i = 0; i < count; i++) {
      const taskData = generateTestTask();

      const { data: task, error } = await supabase
        .from("tasks")
        .insert({
          ...taskData,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating test task:", error);
        continue;
      }

      tasks.push(task);

      // Log the event
      await supabase.from("activity_log").insert({
        user_id: user.id,
        user_email: user.email,
        action: "test_task_created",
        resource_type: "task",
        resource_id: task.id,
        resource_name: task.title,
        details: { source_type: taskData.source_type, priority: taskData.priority, test_mode: true },
      });
    }

    return NextResponse.json({
      tasks,
      message: `Created ${tasks.length} test task(s)`
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating test tasks:", error);
    return NextResponse.json({ error: "Failed to create test tasks" }, { status: 500 });
  }
}

// DELETE - Remove all test tasks
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Check if user is admin or owner
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "owner"].includes(profile.role)) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  }

  try {
    // Delete all tasks where source_email_id starts with 'test_'
    const { data: deletedTasks, error } = await supabase
      .from("tasks")
      .delete()
      .like("source_email_id", "test_%")
      .select("id");

    if (error) {
      console.error("Error deleting test tasks:", error);
      return NextResponse.json({ error: "Failed to delete test tasks" }, { status: 500 });
    }

    const deletedCount = deletedTasks?.length || 0;

    // Log the cleanup event
    await supabase.from("activity_log").insert({
      user_id: user.id,
      user_email: user.email,
      action: "test_tasks_cleared",
      resource_type: "task",
      resource_id: null,
      resource_name: "Test Data Cleanup",
      details: { deleted_count: deletedCount },
    });

    return NextResponse.json({
      message: `Deleted ${deletedCount} test task(s)`,
      deleted_count: deletedCount
    });
  } catch (error) {
    console.error("Error deleting test tasks:", error);
    return NextResponse.json({ error: "Failed to delete test tasks" }, { status: 500 });
  }
}

// GET - Get test task statistics
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Count test tasks
    const { count: testTaskCount } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .like("source_email_id", "test_%");

    // Count by status
    const { data: statusCounts } = await supabase
      .from("tasks")
      .select("status")
      .like("source_email_id", "test_%");

    const statusBreakdown = (statusCounts || []).reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Count assigned vs unassigned
    const { count: assignedCount } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .like("source_email_id", "test_%")
      .not("assigned_to", "is", null);

    return NextResponse.json({
      total_test_tasks: testTaskCount || 0,
      assigned: assignedCount || 0,
      unassigned: (testTaskCount || 0) - (assignedCount || 0),
      by_status: statusBreakdown,
    });
  } catch (error) {
    console.error("Error getting test task stats:", error);
    return NextResponse.json({ error: "Failed to get test task stats" }, { status: 500 });
  }
}
