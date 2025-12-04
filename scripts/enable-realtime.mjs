import pg from "pg";
const { Client } = pg;

const client = new Client({
  connectionString:
    "postgresql://postgres:ttandSellaBella1234@db.cyygkhwujcrbhzgjqipj.supabase.co:5432/postgres",
  ssl: { rejectUnauthorized: false },
});

async function enableRealtime() {
  try {
    await client.connect();
    console.log("Connected to database");

    // Enable REPLICA IDENTITY FULL for better realtime support
    // This ensures we get full row data in realtime events
    await client.query(`
      ALTER TABLE public.calls REPLICA IDENTITY FULL;
    `);
    console.log("Set REPLICA IDENTITY FULL on calls table");

    // Add calls table to the supabase_realtime publication
    // First check if it's already in the publication
    const result = await client.query(`
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'calls';
    `);

    if (result.rows.length === 0) {
      await client.query(`
        ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
      `);
      console.log("Added calls table to supabase_realtime publication");
    } else {
      console.log("calls table already in supabase_realtime publication");
    }

    // Do the same for webhook_logs table
    await client.query(`
      ALTER TABLE public.webhook_logs REPLICA IDENTITY FULL;
    `);
    console.log("Set REPLICA IDENTITY FULL on webhook_logs table");

    const webhookResult = await client.query(`
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'webhook_logs';
    `);

    if (webhookResult.rows.length === 0) {
      await client.query(`
        ALTER PUBLICATION supabase_realtime ADD TABLE public.webhook_logs;
      `);
      console.log("Added webhook_logs table to supabase_realtime publication");
    } else {
      console.log("webhook_logs table already in supabase_realtime publication");
    }

    // Also enable for activity_log for general notifications
    await client.query(`
      ALTER TABLE public.activity_log REPLICA IDENTITY FULL;
    `);
    console.log("Set REPLICA IDENTITY FULL on activity_log table");

    const activityResult = await client.query(`
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'activity_log';
    `);

    if (activityResult.rows.length === 0) {
      await client.query(`
        ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;
      `);
      console.log("Added activity_log table to supabase_realtime publication");
    } else {
      console.log("activity_log table already in supabase_realtime publication");
    }

    // Enable for tasks table
    await client.query(`
      ALTER TABLE public.tasks REPLICA IDENTITY FULL;
    `);
    console.log("Set REPLICA IDENTITY FULL on tasks table");

    const tasksResult = await client.query(`
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'tasks';
    `);

    if (tasksResult.rows.length === 0) {
      await client.query(`
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
      `);
      console.log("Added tasks table to supabase_realtime publication");
    } else {
      console.log("tasks table already in supabase_realtime publication");
    }

    console.log("\nRealtime enabled successfully for all tables!");
    console.log("Tables with realtime enabled: calls, webhook_logs, activity_log, tasks");

  } catch (error) {
    console.error("Error enabling realtime:", error);
  } finally {
    await client.end();
  }
}

enableRealtime();
