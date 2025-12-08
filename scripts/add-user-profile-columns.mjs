import pg from "pg";

const { Client } = pg;

const client = new Client({
  connectionString:
    "postgresql://postgres:ttandSellaBella1234@db.cyygkhwujcrbhzgjqipj.supabase.co:5432/postgres",
  ssl: { rejectUnauthorized: false },
});

async function addUserProfileColumns() {
  await client.connect();

  try {
    console.log("Adding additional columns to user_profiles table...");

    // Add role column
    await client.query(`
      ALTER TABLE public.user_profiles
      ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'staff';
    `);
    console.log("Added role column");

    // Add department column
    await client.query(`
      ALTER TABLE public.user_profiles
      ADD COLUMN IF NOT EXISTS department TEXT;
    `);
    console.log("Added department column");

    // Add job_title column
    await client.query(`
      ALTER TABLE public.user_profiles
      ADD COLUMN IF NOT EXISTS job_title TEXT;
    `);
    console.log("Added job_title column");

    // Add phone column
    await client.query(`
      ALTER TABLE public.user_profiles
      ADD COLUMN IF NOT EXISTS phone TEXT;
    `);
    console.log("Added phone column");

    // Add is_active column
    await client.query(`
      ALTER TABLE public.user_profiles
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    `);
    console.log("Added is_active column");

    // Add last_login column
    await client.query(`
      ALTER TABLE public.user_profiles
      ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
    `);
    console.log("Added last_login column");

    // Verify columns
    const result = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'user_profiles'
      ORDER BY ordinal_position;
    `);
    console.log("Current columns:", result.rows);

  } catch (error) {
    console.error("Error:", error);
    throw error;
  } finally {
    await client.end();
  }
}

addUserProfileColumns().catch(console.error);
