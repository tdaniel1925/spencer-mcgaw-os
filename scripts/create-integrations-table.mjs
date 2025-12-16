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

async function createIntegrationsTable() {
  console.log("Creating integrations table for OAuth token storage...\n");

  const client = await pool.connect();

  try {
    // Create integrations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS integrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider VARCHAR(50) NOT NULL UNIQUE,
        access_token TEXT,
        refresh_token TEXT,
        token_expires_at TIMESTAMPTZ,
        account_key VARCHAR(255),
        channel_id VARCHAR(255),
        webhook_url TEXT,
        is_connected BOOLEAN NOT NULL DEFAULT false,
        config JSONB DEFAULT '{}',
        last_synced_at TIMESTAMPTZ,
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log("  ✓ Created integrations table");

    // Create index on provider
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_integrations_provider ON integrations(provider);
    `);
    console.log("  ✓ Created index on provider");

    // Insert GoTo integration record (will be updated when user connects)
    await client.query(`
      INSERT INTO integrations (provider, is_connected)
      VALUES ('goto', false)
      ON CONFLICT (provider) DO NOTHING;
    `);
    console.log("  ✓ Created initial GoTo integration record");

    // Insert Nylas integration record
    await client.query(`
      INSERT INTO integrations (provider, is_connected)
      VALUES ('nylas', false)
      ON CONFLICT (provider) DO NOTHING;
    `);
    console.log("  ✓ Created initial Nylas integration record");

    // Create updated_at trigger function
    await client.query(`
      CREATE OR REPLACE FUNCTION update_integrations_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create trigger
    await client.query(`
      DROP TRIGGER IF EXISTS integrations_updated_at ON integrations;
      CREATE TRIGGER integrations_updated_at
        BEFORE UPDATE ON integrations
        FOR EACH ROW
        EXECUTE FUNCTION update_integrations_updated_at();
    `);
    console.log("  ✓ Created updated_at trigger");

    console.log("\n✅ Integrations table created successfully!");

  } catch (error) {
    console.error("Error creating integrations table:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

createIntegrationsTable().catch(console.error);
