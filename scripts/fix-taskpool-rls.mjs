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

async function fixRLS() {
  const client = await pool.connect();
  try {
    console.log("Fixing RLS policies for TaskPool tables...\n");

    // Enable RLS on task_action_types and add policy for authenticated users
    console.log("1. Enabling RLS on task_action_types...");
    await client.query(`ALTER TABLE task_action_types ENABLE ROW LEVEL SECURITY`);

    // Drop existing policy if exists and create new one
    console.log("2. Creating RLS policy for task_action_types...");
    await client.query(`
      DROP POLICY IF EXISTS "Allow authenticated read task_action_types" ON task_action_types
    `);
    await client.query(`
      CREATE POLICY "Allow authenticated read task_action_types" ON task_action_types
      FOR SELECT TO authenticated
      USING (true)
    `);

    // Add insert/update policy for admins (optional)
    await client.query(`
      DROP POLICY IF EXISTS "Allow authenticated all task_action_types" ON task_action_types
    `);
    await client.query(`
      CREATE POLICY "Allow authenticated all task_action_types" ON task_action_types
      FOR ALL TO authenticated
      USING (true)
      WITH CHECK (true)
    `);

    console.log("✓ task_action_types RLS configured\n");

    // Verify tasks table RLS is correct
    console.log("3. Verifying tasks table RLS...");
    const tasksRls = await client.query(`
      SELECT policyname, cmd FROM pg_policies WHERE tablename = 'tasks'
    `);
    console.log("Tasks policies:", tasksRls.rows);

    // Ensure we have proper RLS for tasks
    await client.query(`
      DROP POLICY IF EXISTS "Allow authenticated all tasks" ON tasks
    `);
    await client.query(`
      CREATE POLICY "Allow authenticated all tasks" ON tasks
      FOR ALL TO authenticated
      USING (true)
      WITH CHECK (true)
    `);
    console.log("✓ tasks RLS configured\n");

    // Also ensure task_notes and task_activity_log have RLS
    console.log("4. Configuring RLS for task_notes...");
    await client.query(`ALTER TABLE task_notes ENABLE ROW LEVEL SECURITY`);
    await client.query(`
      DROP POLICY IF EXISTS "Allow authenticated all task_notes" ON task_notes
    `);
    await client.query(`
      CREATE POLICY "Allow authenticated all task_notes" ON task_notes
      FOR ALL TO authenticated
      USING (true)
      WITH CHECK (true)
    `);
    console.log("✓ task_notes RLS configured\n");

    console.log("5. Configuring RLS for task_activity_log...");
    await client.query(`ALTER TABLE task_activity_log ENABLE ROW LEVEL SECURITY`);
    await client.query(`
      DROP POLICY IF EXISTS "Allow authenticated all task_activity_log" ON task_activity_log
    `);
    await client.query(`
      CREATE POLICY "Allow authenticated all task_activity_log" ON task_activity_log
      FOR ALL TO authenticated
      USING (true)
      WITH CHECK (true)
    `);
    console.log("✓ task_activity_log RLS configured\n");

    console.log("All TaskPool RLS policies configured successfully!");

  } catch (error) {
    console.error("Error:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

fixRLS().catch(console.error);
