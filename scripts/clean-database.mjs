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

async function cleanDatabase() {
  console.log("🗑️  Cleaning database - removing all test/dummy data...\n");

  const client = await pool.connect();

  try {
    // Check counts before
    const callsBefore = await client.query("SELECT COUNT(*) as count FROM calls");
    const emailsBefore = await client.query("SELECT COUNT(*) as count FROM email_classifications");
    const tasksBefore = await client.query("SELECT COUNT(*) as count FROM tasks");
    const activityBefore = await client.query("SELECT COUNT(*) as count FROM activity_logs");
    const webhooksBefore = await client.query("SELECT COUNT(*) as count FROM webhook_logs");

    console.log("Before cleanup:");
    console.log(`  - Calls: ${callsBefore.rows[0].count}`);
    console.log(`  - Email Classifications: ${emailsBefore.rows[0].count}`);
    console.log(`  - Tasks: ${tasksBefore.rows[0].count}`);
    console.log(`  - Activity Logs: ${activityBefore.rows[0].count}`);
    console.log(`  - Webhook Logs: ${webhooksBefore.rows[0].count}`);
    console.log("");

    // Delete in order (respecting foreign keys)
    console.log("Deleting data...");

    await client.query("DELETE FROM webhook_logs");
    console.log("  ✓ Webhook logs deleted");

    await client.query("DELETE FROM activity_logs");
    console.log("  ✓ Activity logs deleted");

    await client.query("DELETE FROM tasks");
    console.log("  ✓ Tasks deleted");

    await client.query("DELETE FROM email_classifications");
    console.log("  ✓ Email classifications deleted");

    await client.query("DELETE FROM calls");
    console.log("  ✓ Calls deleted");

    // Check counts after
    const callsAfter = await client.query("SELECT COUNT(*) as count FROM calls");
    const emailsAfter = await client.query("SELECT COUNT(*) as count FROM email_classifications");
    const tasksAfter = await client.query("SELECT COUNT(*) as count FROM tasks");
    const activityAfter = await client.query("SELECT COUNT(*) as count FROM activity_logs");
    const webhooksAfter = await client.query("SELECT COUNT(*) as count FROM webhook_logs");

    console.log("\nAfter cleanup:");
    console.log(`  - Calls: ${callsAfter.rows[0].count}`);
    console.log(`  - Email Classifications: ${emailsAfter.rows[0].count}`);
    console.log(`  - Tasks: ${tasksAfter.rows[0].count}`);
    console.log(`  - Activity Logs: ${activityAfter.rows[0].count}`);
    console.log(`  - Webhook Logs: ${webhooksAfter.rows[0].count}`);

    console.log("\n✅ Database cleaned successfully! Ready for real data.");

  } catch (error) {
    console.error("Error cleaning database:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanDatabase();
