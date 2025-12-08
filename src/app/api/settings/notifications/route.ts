import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface NotificationPreferences {
  // Email Notifications
  emailNewTask: boolean;
  emailTaskAssigned: boolean;
  emailTaskDueSoon: boolean;
  emailTaskOverdue: boolean;
  emailTaskCompleted: boolean;
  emailClientActivity: boolean;
  emailWeeklySummary: boolean;

  // In-App Notifications
  inappNewTask: boolean;
  inappTaskAssigned: boolean;
  inappTaskDueSoon: boolean;
  inappTaskOverdue: boolean;
  inappTaskCompleted: boolean;
  inappMentions: boolean;
  inappClientActivity: boolean;

  // SMS Notifications
  smsEnabled: boolean;
  smsUrgentOnly: boolean;
  smsTaskOverdue: boolean;

  // AI/Email Intelligence Notifications
  aiEmailProcessed: boolean;
  aiHighPriorityDetected: boolean;
  aiActionItemsExtracted: boolean;

  // Schedule
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  emailNewTask: true,
  emailTaskAssigned: true,
  emailTaskDueSoon: true,
  emailTaskOverdue: true,
  emailTaskCompleted: false,
  emailClientActivity: true,
  emailWeeklySummary: true,

  inappNewTask: true,
  inappTaskAssigned: true,
  inappTaskDueSoon: true,
  inappTaskOverdue: true,
  inappTaskCompleted: true,
  inappMentions: true,
  inappClientActivity: true,

  smsEnabled: false,
  smsUrgentOnly: true,
  smsTaskOverdue: false,

  aiEmailProcessed: true,
  aiHighPriorityDetected: true,
  aiActionItemsExtracted: true,

  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
};

// GET - Get user's notification preferences
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { data: prefs, error } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching notification preferences:", error);
      return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 });
    }

    // Return preferences or defaults
    if (!prefs) {
      return NextResponse.json(DEFAULT_PREFERENCES);
    }

    return NextResponse.json({
      emailNewTask: prefs.email_new_task ?? true,
      emailTaskAssigned: prefs.email_task_assigned ?? true,
      emailTaskDueSoon: prefs.email_task_due_soon ?? true,
      emailTaskOverdue: prefs.email_task_overdue ?? true,
      emailTaskCompleted: prefs.email_task_completed ?? false,
      emailClientActivity: prefs.email_client_activity ?? true,
      emailWeeklySummary: prefs.email_weekly_summary ?? true,

      inappNewTask: prefs.inapp_new_task ?? true,
      inappTaskAssigned: prefs.inapp_task_assigned ?? true,
      inappTaskDueSoon: prefs.inapp_task_due_soon ?? true,
      inappTaskOverdue: prefs.inapp_task_overdue ?? true,
      inappTaskCompleted: prefs.inapp_task_completed ?? true,
      inappMentions: prefs.inapp_mentions ?? true,
      inappClientActivity: prefs.inapp_client_activity ?? true,

      smsEnabled: prefs.sms_enabled ?? false,
      smsUrgentOnly: prefs.sms_urgent_only ?? true,
      smsTaskOverdue: prefs.sms_task_overdue ?? false,

      aiEmailProcessed: prefs.ai_email_processed ?? true,
      aiHighPriorityDetected: prefs.ai_high_priority_detected ?? true,
      aiActionItemsExtracted: prefs.ai_action_items_extracted ?? true,

      quietHoursEnabled: prefs.quiet_hours_enabled ?? false,
      quietHoursStart: prefs.quiet_hours_start ?? "22:00",
      quietHoursEnd: prefs.quiet_hours_end ?? "07:00",
    } as NotificationPreferences);
  } catch (error) {
    console.error("Error in notification preferences GET:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT - Update user's notification preferences
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body: NotificationPreferences = await request.json();

    // Upsert preferences
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({
        user_id: user.id,

        email_new_task: body.emailNewTask,
        email_task_assigned: body.emailTaskAssigned,
        email_task_due_soon: body.emailTaskDueSoon,
        email_task_overdue: body.emailTaskOverdue,
        email_task_completed: body.emailTaskCompleted,
        email_client_activity: body.emailClientActivity,
        email_weekly_summary: body.emailWeeklySummary,

        inapp_new_task: body.inappNewTask,
        inapp_task_assigned: body.inappTaskAssigned,
        inapp_task_due_soon: body.inappTaskDueSoon,
        inapp_task_overdue: body.inappTaskOverdue,
        inapp_task_completed: body.inappTaskCompleted,
        inapp_mentions: body.inappMentions,
        inapp_client_activity: body.inappClientActivity,

        sms_enabled: body.smsEnabled,
        sms_urgent_only: body.smsUrgentOnly,
        sms_task_overdue: body.smsTaskOverdue,

        ai_email_processed: body.aiEmailProcessed,
        ai_high_priority_detected: body.aiHighPriorityDetected,
        ai_action_items_extracted: body.aiActionItemsExtracted,

        quiet_hours_enabled: body.quietHoursEnabled,
        quiet_hours_start: body.quietHoursStart,
        quiet_hours_end: body.quietHoursEnd,

        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error("Error updating notification preferences:", error);
      return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Notification preferences updated" });
  } catch (error) {
    console.error("Error in notification preferences PUT:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
