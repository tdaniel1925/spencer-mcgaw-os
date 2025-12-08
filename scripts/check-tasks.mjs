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

async function check() {
  const client = await pool.connect();
  try {
    // Check all tasks with their action types
    const tasksRes = await client.query(`
      SELECT
        t.id,
        t.title,
        t.status,
        t.claimed_by,
        t.action_type_id,
        tat.code as action_type_code,
        tat.label as action_type_label
      FROM tasks t
      LEFT JOIN task_action_types tat ON t.action_type_id = tat.id
      ORDER BY t.created_at DESC
    `);

    console.log("Tasks in database:");
    console.log("==================");
    tasksRes.rows.forEach((r) => {
      console.log(`- ${r.action_type_label || 'NO TYPE'} | ${r.title?.substring(0, 40)}`);
      console.log(`  status: ${r.status}, claimed: ${r.claimed_by ? 'yes' : 'no'}`);
      console.log(`  action_type_id: ${r.action_type_id}`);
      console.log();
    });

    console.log(`Total: ${tasksRes.rows.length} tasks`);

    // Check action types
    console.log("\nAction Types in database:");
    console.log("=========================");
    const typesRes = await client.query(`SELECT id, code, label FROM task_action_types ORDER BY sort_order`);
    typesRes.rows.forEach((r) => console.log(`- ${r.code}: ${r.label} (${r.id})`));

  } finally {
    client.release();
    await pool.end();
  }
}
check().catch(console.error);
