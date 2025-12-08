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

async function fixColumnType() {
  const client = await pool.connect();
  try {
    console.log("Fixing tasks.source_email_id column type from UUID to TEXT...\n");

    // Change column type from UUID to TEXT
    await client.query(`
      ALTER TABLE tasks
      ALTER COLUMN source_email_id TYPE TEXT
    `);
    console.log("✓ Changed source_email_id column to TEXT");

    // Verify
    const verifyRes = await client.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'tasks' AND column_name = 'source_email_id'
    `);
    console.log("\nVerification - tasks.source_email_id is now:");
    verifyRes.rows.forEach((r) => console.log("-", r.data_type, r.udt_name));

    console.log("\n✓ Done! The sync should now work correctly.");

  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixColumnType();
