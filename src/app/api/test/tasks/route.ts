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

// Sample email bodies for test emails
const sampleEmailBodies = [
  `Hi Team,

I wanted to follow up on our previous discussion regarding the quarterly tax documents. We've uploaded the following documents to the client portal:

- Q4 Profit & Loss Statement
- Balance Sheet as of December 31st
- Bank Reconciliation Summary
- Accounts Receivable Aging Report

Please review these at your earliest convenience and let me know if you need any additional information or clarification on any items.

Best regards,
Sarah Johnson
Johnson Family Trust`,

  `Hello,

We've noticed some discrepancies in the W-2 forms that were recently processed. Specifically:

1. Employee John Smith's bonus was reported incorrectly
2. The 401(k) contributions for Q3 don't match our records
3. Health insurance deductions seem to be missing for September

Can you please investigate and provide corrected forms as soon as possible? We need to resolve this before the filing deadline.

Thank you,
Mike Thompson
ABC Manufacturing - HR Department`,

  `Team,

Quick question about the payroll run for this month. We have 3 new hires starting on the 15th and need to make sure they're set up correctly in the system.

Also, can you confirm the following:
- Direct deposit setup for Emily Chen
- Tax withholding adjustments for Robert Garcia
- Benefits enrollment completion for all new employees

Please advise on the timeline for getting these processed.

Thanks!
HR Admin`,

  `Good morning,

This is a reminder that the 1099 filing deadline is approaching in 2 weeks. We have the following outstanding items that need your attention:

- 12 contractor 1099s pending review
- 3 vendor payments that need classification
- Updated W-9 forms needed from 5 contractors

Please prioritize these items to ensure timely filing.

Best,
Accounting Team`,
];

// Sample call transcripts for test calls
const sampleCallTranscripts = [
  `[00:00] Agent: Thank you for calling Spencer McGaw. This is Sarah speaking. How can I help you today?

[00:05] Caller: Hi Sarah, this is Mike from Peterson Industries. I need to discuss an urgent matter regarding our tax filing.

[00:12] Agent: Of course, Mike. What seems to be the issue?

[00:15] Caller: We just realized we need to file for an extension. Our CFO has been out sick and we don't have all the documentation ready yet.

[00:25] Agent: I understand. Let me check your account... I can see your filing is due in 10 days. We can certainly help with the extension. Have you gathered any of the required documents?

[00:38] Caller: Yes, we have the P&L and balance sheet, but we're still waiting on the inventory valuation and some K-1s from our partnerships.

[00:48] Agent: That's good progress. I'll flag this as urgent for our team and we'll prepare the extension paperwork today. Someone will reach out within 24 hours with next steps.

[00:58] Caller: That's a huge relief. Thank you so much, Sarah.

[01:02] Agent: You're welcome, Mike. Is there anything else I can help you with today?

[01:06] Caller: No, that's everything. Thanks again.

[01:08] Agent: Have a great day!`,

  `[00:00] Agent: Spencer McGaw, this is David. How may I assist you?

[00:04] Caller: Hi David, I'm calling about an IRS notice we received. It's regarding our 2022 tax return.

[00:12] Agent: I'm sorry to hear that. Can you tell me what the notice says? Do you have a notice number?

[00:18] Caller: Yes, it's Notice CP2000. They're saying we underreported income by about $15,000.

[00:28] Agent: Okay, CP2000 notices are common and usually relate to information matching issues. This could be from a 1099 or W-2 that didn't match what was reported. Do you recall any income that might not have been included?

[00:42] Caller: Actually, now that you mention it, I did some consulting work on the side that year. I thought my accountant handled it.

[00:50] Agent: That could very well be it. I'll mark this as urgent for review. Can you scan and email the notice to us? We'll need to respond within 30 days.

[01:02] Caller: Yes, I'll do that right away.

[01:05] Agent: Perfect. Once we receive it, someone from our team will call you to discuss the response strategy.

[01:12] Caller: Thank you so much for your help.

[01:14] Agent: Of course. We'll get this sorted out for you.`,

  `[00:00] Agent: Good afternoon, Spencer McGaw. This is Jennifer.

[00:03] Caller: Hi Jennifer, I'm calling to schedule our quarterly review meeting.

[00:08] Agent: Of course! Let me pull up your account... I see you're with Legal Associates LLP. When were you thinking?

[00:16] Caller: We'd prefer sometime next week if possible. Wednesday or Thursday afternoon would work best.

[00:23] Agent: Let me check the calendar... We have availability on Wednesday at 2 PM or Thursday at 3 PM. Which works better for you?

[00:32] Caller: Thursday at 3 PM would be perfect.

[00:35] Agent: Great, I'll book that in. Will the same attendees be joining - yourself and your partner Maria?

[00:42] Caller: Yes, and we might have our new office manager join as well if that's okay.

[00:47] Agent: Absolutely. I'll send a calendar invite with the video conference link shortly. Anything specific you'd like to discuss during the review?

[00:56] Caller: Just the usual - year-to-date financials, cash flow projections, and we want to discuss setting up a profit-sharing plan.

[01:05] Agent: Perfect. I'll make a note for the team to prepare materials on profit-sharing options. See you Thursday!

[01:12] Caller: Thanks, Jennifer. Have a great day!`,
];

function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

// Sample sender names and emails
const sampleSenders = [
  { name: "Sarah Johnson", email: "sarah.johnson@johnsonfamilytrust.com" },
  { name: "Mike Thompson", email: "mike.t@abcmanufacturing.com" },
  { name: "Jennifer Lee", email: "jlee@techstartup.io" },
  { name: "Robert Garcia", email: "rgarcia@healthcarepartners.org" },
  { name: "Emily Chen", email: "emily.chen@greenergycorp.com" },
];

const sampleCallers = [
  { name: "Mike Peterson", phone: "+1 (555) 123-4567" },
  { name: "David Wilson", phone: "+1 (555) 234-5678" },
  { name: "Lisa Martinez", phone: "+1 (555) 345-6789" },
  { name: "James Anderson", phone: "+1 (555) 456-7890" },
  { name: "Karen Brown", phone: "+1 (555) 567-8901" },
];

function generateTestTask() {
  const isEmail = Math.random() > 0.4; // 60% emails, 40% phone calls
  const scenario = isEmail
    ? getRandomItem(emailScenarios)
    : getRandomItem(phoneCallScenarios);

  const sourceType = isEmail ? "email" : "phone_call";
  const testId = `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // Generate source metadata based on type
  let sourceMetadata: Record<string, unknown>;

  if (isEmail) {
    const sender = getRandomItem(sampleSenders);
    sourceMetadata = {
      email_subject: scenario.subject,
      sender_name: sender.name,
      sender_email: sender.email,
      email_body: getRandomItem(sampleEmailBodies),
      extraction_summary: `AI extracted task from email regarding ${scenario.subject.toLowerCase()}. Sender: ${sender.name} from ${scenario.client}.`,
    };
  } else {
    const caller = getRandomItem(sampleCallers);
    const duration = Math.floor(Math.random() * 300) + 60; // 1-6 minutes
    sourceMetadata = {
      caller_name: caller.name,
      caller_phone: caller.phone,
      call_transcript: getRandomItem(sampleCallTranscripts),
      call_duration: duration,
      recording_url: "https://example.com/sample-recording.mp3", // Placeholder URL
    };
  }

  return {
    title: scenario.subject,
    description: getRandomItem(descriptions),
    status: "pending" as const,
    priority: scenario.priority,
    source_type: sourceType,
    source_email_id: testId,
    source_metadata: sourceMetadata,
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
