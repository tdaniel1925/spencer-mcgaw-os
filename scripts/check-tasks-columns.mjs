import pg from "pg";

const { Client } = pg;

const client = new Client({
  connectionString:
    "postgresql://postgres:ttandSellaBella1234@db.cyygkhwujcrbhzgjqipj.supabase.co:5432/postgres",
  ssl: { rejectUnauthorized: false },
});

async function checkColumns() {
  await client.connect();

  try {
    const result = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'tasks'
      ORDER BY ordinal_position;
    `);
    console.log("Tasks table columns:", JSON.stringify(result.rows, null, 2));
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.end();
  }
}

checkColumns();
