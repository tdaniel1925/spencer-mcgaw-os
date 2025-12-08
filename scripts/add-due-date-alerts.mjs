import pg from "pg";

const { Client } = pg;

const client = new Client({
  connectionString:
    "postgresql://postgres:ttandSellaBella1234@db.cyygkhwujcrbhzgjqipj.supabase.co:5432/postgres",
  ssl: { rejectUnauthorized: false },
});

async function addDueDateAlerts() {
  await client.connect();

  try {
    console.log("Adding due date alert columns to tasks table...");

    // Add alert_threshold_hours column - how many hours before due date to alert
    await client.query(`
      ALTER TABLE public.tasks
      ADD COLUMN IF NOT EXISTS alert_threshold_hours INTEGER DEFAULT 24;
    `);
    console.log("Added alert_threshold_hours column (default 24 hours)");

    // Add alert_sent_at column - when the last alert email was sent
    await client.query(`
      ALTER TABLE public.tasks
      ADD COLUMN IF NOT EXISTS alert_sent_at TIMESTAMPTZ;
    `);
    console.log("Added alert_sent_at column");

    // Add alert_dismissed column - user can dismiss the flashing alert
    await client.query(`
      ALTER TABLE public.tasks
      ADD COLUMN IF NOT EXISTS alert_dismissed BOOLEAN DEFAULT false;
    `);
    console.log("Added alert_dismissed column");

    // Create due_date_alerts table for tracking multiple alert levels
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.due_date_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
        alert_type TEXT NOT NULL, -- 'approaching', 'urgent', 'overdue'
        threshold_hours INTEGER NOT NULL,
        email_sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    console.log("Created due_date_alerts table");

    // Create index for efficient querying
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_due_date_alerts_task_id ON public.due_date_alerts(task_id);
    `);
    console.log("Created index on due_date_alerts");

    // Enable RLS on due_date_alerts
    await client.query(`
      ALTER TABLE public.due_date_alerts ENABLE ROW LEVEL SECURITY;
    `);
    console.log("Enabled RLS on due_date_alerts");

    // Create policy for due_date_alerts
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies WHERE tablename = 'due_date_alerts' AND policyname = 'Enable all for authenticated users'
        ) THEN
          CREATE POLICY "Enable all for authenticated users" ON public.due_date_alerts
            FOR ALL USING (true) WITH CHECK (true);
        END IF;
      END $$;
    `);
    console.log("Created RLS policy for due_date_alerts");

    // Verify columns
    const result = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'tasks'
      AND column_name IN ('due_date', 'alert_threshold_hours', 'alert_sent_at', 'alert_dismissed')
      ORDER BY ordinal_position;
    `);
    console.log("Alert-related columns:", result.rows);

    console.log("\nDue date alert columns added successfully!");

  } catch (error) {
    console.error("Error:", error);
    throw error;
  } finally {
    await client.end();
  }
}

addDueDateAlerts().catch(console.error);
