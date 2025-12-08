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

const DEFAULT_ORGANIZATION_ID = "00000000-0000-0000-0000-000000000001";

// Map email action item types to TaskPool action type codes
const ACTION_TYPE_MAP = {
  response: "RESPOND",
  document: "PREPARE",
  calendar: "SCHEDULE",
  task: "PROCESS",
  call: "RESPOND",
  review: "REVIEW",
};

async function createTasksFromActionItems() {
  const client = await pool.connect();
  try {
    console.log("Creating tasks from existing email action items...\n");

    // Get action types
    const actionTypesRes = await client.query(
      "SELECT id, code FROM task_action_types WHERE is_active = true"
    );
    const actionTypeByCode = {};
    actionTypesRes.rows.forEach((r) => {
      actionTypeByCode[r.code] = r.id;
    });
    console.log("Action types loaded:", Object.keys(actionTypeByCode).join(", "));

    // Get all email action items that don't have corresponding tasks
    const actionItemsRes = await client.query(`
      SELECT
        eai.id,
        eai.email_message_id,
        eai.title,
        eai.description,
        eai.action_type,
        eai.priority,
        eai.mentioned_date,
        eai.confidence,
        ec.summary as classification_summary,
        ec.category as classification_category
      FROM email_action_items eai
      LEFT JOIN email_classifications ec ON eai.email_message_id = ec.email_message_id
      WHERE NOT EXISTS (
        SELECT 1 FROM tasks t WHERE t.source_email_id = eai.email_message_id
      )
    `);

    console.log(`Found ${actionItemsRes.rows.length} action items without tasks\n`);

    // Get a user ID (we need this for created_by)
    const userRes = await client.query("SELECT id FROM auth.users LIMIT 1");
    const userId = userRes.rows[0]?.id;
    if (!userId) {
      console.error("No user found in auth.users");
      return;
    }
    console.log("Using user ID:", userId);

    let created = 0;
    for (const item of actionItemsRes.rows) {
      const taskPoolActionCode = ACTION_TYPE_MAP[item.action_type] || "PROCESS";
      const taskPoolActionTypeId = actionTypeByCode[taskPoolActionCode];

      if (!taskPoolActionTypeId) {
        console.warn(`No action type found for: ${item.action_type} -> ${taskPoolActionCode}`);
        continue;
      }

      try {
        const insertRes = await client.query(`
          INSERT INTO tasks (
            title, description, action_type_id, priority, due_date,
            source_type, source_email_id, ai_confidence,
            status, organization_id, created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING id
        `, [
          item.title,
          `${item.description || ""}\n\nAI Summary: ${item.classification_summary || ""}`,
          taskPoolActionTypeId,
          item.priority || "medium",
          item.mentioned_date,
          "email",
          item.email_message_id,
          item.confidence,
          "open",
          DEFAULT_ORGANIZATION_ID,
          userId
        ]);

        console.log(`✓ Created task: ${item.title.substring(0, 50)}`);
        created++;
      } catch (err) {
        console.error(`✗ Failed to create task for: ${item.title}`, err.message);
      }
    }

    console.log(`\nCreated ${created} tasks from ${actionItemsRes.rows.length} action items`);

  } finally {
    client.release();
    await pool.end();
  }
}

createTasksFromActionItems().catch(console.error);
