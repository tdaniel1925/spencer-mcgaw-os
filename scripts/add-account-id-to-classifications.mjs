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

async function addAccountIdColumn() {
  const client = await pool.connect();
  try {
    console.log("Adding account_id column to email_classifications...");

    // Add account_id column
    await client.query(`
      ALTER TABLE email_classifications
      ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES email_connections(id) ON DELETE CASCADE;
    `);
    console.log("Added account_id column to email_classifications");

    // Add account_id to email_action_items too
    await client.query(`
      ALTER TABLE email_action_items
      ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES email_connections(id) ON DELETE CASCADE;
    `);
    console.log("Added account_id column to email_action_items");

    // Add indexes for faster cleanup
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_classifications_account ON email_classifications(account_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_action_items_account ON email_action_items(account_id);
    `);
    console.log("Added indexes");

    console.log("Done! Now classifications will be automatically deleted when an account is disconnected.");

  } catch (error) {
    console.error("Error:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addAccountIdColumn();
