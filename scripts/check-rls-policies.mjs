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

async function checkRLS() {
  const client = await pool.connect();
  try {
    // Check if RLS is enabled on tasks
    const rlsRes = await client.query(`
      SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class
      WHERE relname = 'tasks'
    `);
    console.log("RLS status on tasks table:");
    console.log(rlsRes.rows[0]);

    // Check RLS policies
    const policiesRes = await client.query(`
      SELECT policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE tablename = 'tasks'
    `);
    console.log("\nRLS Policies on tasks:");
    if (policiesRes.rows.length === 0) {
      console.log("  No policies found!");
    } else {
      policiesRes.rows.forEach((p) => {
        console.log(`  - ${p.policyname}:`);
        console.log(`    cmd: ${p.cmd}, permissive: ${p.permissive}`);
        console.log(`    roles: ${p.roles}`);
        console.log(`    qual: ${p.qual}`);
      });
    }

    // Also check task_action_types
    const actionTypesRlsRes = await client.query(`
      SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class
      WHERE relname = 'task_action_types'
    `);
    console.log("\nRLS status on task_action_types table:");
    console.log(actionTypesRlsRes.rows[0]);

    const actionTypesPoliciesRes = await client.query(`
      SELECT policyname, permissive, roles, cmd, qual
      FROM pg_policies
      WHERE tablename = 'task_action_types'
    `);
    console.log("\nRLS Policies on task_action_types:");
    if (actionTypesPoliciesRes.rows.length === 0) {
      console.log("  No policies found!");
    } else {
      actionTypesPoliciesRes.rows.forEach((p) => {
        console.log(`  - ${p.policyname}: ${p.cmd}, qual: ${p.qual}`);
      });
    }

  } finally {
    client.release();
    await pool.end();
  }
}

checkRLS().catch(console.error);
