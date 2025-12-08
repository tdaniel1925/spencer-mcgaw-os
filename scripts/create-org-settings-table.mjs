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

async function createOrgSettingsTable() {
  const client = await pool.connect();
  try {
    console.log("Creating organization_settings table...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS organization_settings (
        id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',
        company_name TEXT NOT NULL DEFAULT 'Spencer McGaw CPA',
        company_email TEXT,
        company_phone TEXT,
        timezone TEXT DEFAULT 'America/Chicago',
        address TEXT,
        website TEXT,
        tax_id TEXT,
        logo_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_by UUID REFERENCES auth.users(id)
      );
    `);

    console.log("Organization settings table created!");

    // Add bio column to users table if not exists
    console.log("Adding bio column to users table...");
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS bio TEXT;
    `);
    console.log("Bio column added!");

    // Insert default settings if not exists
    console.log("Inserting default settings...");
    await client.query(`
      INSERT INTO organization_settings (id, company_name)
      VALUES ('00000000-0000-0000-0000-000000000001', 'Spencer McGaw CPA')
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log("Default settings inserted!");

    // Enable RLS
    console.log("Enabling RLS...");
    await client.query(`
      ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
    `);

    // Create policy for reading (all authenticated users)
    await client.query(`
      DROP POLICY IF EXISTS "Allow authenticated users to read org settings" ON organization_settings;
      CREATE POLICY "Allow authenticated users to read org settings" ON organization_settings
        FOR SELECT USING (auth.role() = 'authenticated');
    `);

    // Create policy for updating (only admins)
    await client.query(`
      DROP POLICY IF EXISTS "Allow admins to update org settings" ON organization_settings;
      CREATE POLICY "Allow admins to update org settings" ON organization_settings
        FOR ALL USING (
          EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'admin'
          )
        );
    `);

    console.log("RLS policies created!");
    console.log("Done!");

  } catch (error) {
    console.error("Error:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

createOrgSettingsTable();
