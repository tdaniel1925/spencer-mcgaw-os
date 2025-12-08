import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  host: "db.cyygkhwujcrbhzgjqipj.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: "ttandSellaBella1234",
  ssl: { rejectUnauthorized: false },
});

async function createNotificationPreferencesTable() {
  const client = await pool.connect();
  try {
    console.log("Creating notification_preferences table...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

        -- Email Notifications
        email_new_task BOOLEAN DEFAULT true,
        email_task_assigned BOOLEAN DEFAULT true,
        email_task_due_soon BOOLEAN DEFAULT true,
        email_task_overdue BOOLEAN DEFAULT true,
        email_task_completed BOOLEAN DEFAULT false,
        email_client_activity BOOLEAN DEFAULT true,
        email_weekly_summary BOOLEAN DEFAULT true,

        -- In-App Notifications
        inapp_new_task BOOLEAN DEFAULT true,
        inapp_task_assigned BOOLEAN DEFAULT true,
        inapp_task_due_soon BOOLEAN DEFAULT true,
        inapp_task_overdue BOOLEAN DEFAULT true,
        inapp_task_completed BOOLEAN DEFAULT true,
        inapp_mentions BOOLEAN DEFAULT true,
        inapp_client_activity BOOLEAN DEFAULT true,

        -- SMS Notifications
        sms_enabled BOOLEAN DEFAULT false,
        sms_urgent_only BOOLEAN DEFAULT true,
        sms_task_overdue BOOLEAN DEFAULT false,

        -- AI/Email Intelligence Notifications
        ai_email_processed BOOLEAN DEFAULT true,
        ai_high_priority_detected BOOLEAN DEFAULT true,
        ai_action_items_extracted BOOLEAN DEFAULT true,

        -- Schedule
        quiet_hours_enabled BOOLEAN DEFAULT false,
        quiet_hours_start TIME DEFAULT '22:00',
        quiet_hours_end TIME DEFAULT '07:00',

        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

        UNIQUE(user_id)
      );
    `);

    console.log("Notification preferences table created!");

    // Enable RLS
    console.log("Enabling RLS...");
    await client.query(`
      ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
    `);

    // Create policy for users to manage their own preferences
    await client.query(`
      DROP POLICY IF EXISTS "Users can manage their own notification preferences" ON notification_preferences;
      CREATE POLICY "Users can manage their own notification preferences" ON notification_preferences
        FOR ALL USING (user_id = auth.uid());
    `);

    console.log("RLS policies created!");
    console.log("Done!");

  } catch (error) {
    console.error("Error:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

createNotificationPreferencesTable();
