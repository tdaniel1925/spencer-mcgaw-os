/**
 * Add client_id column to email_classifications table
 * and create indexes for client communications lookup
 */

import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  host: "db.cyygkhwujcrbhzgjqipj.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: process.env.SUPABASE_DB_PASSWORD || "ttandSellaBella1234",
  ssl: { rejectUnauthorized: false },
});

async function addClientIdToClassifications() {
  const client = await pool.connect();

  try {
    console.log("Adding client_id to email_classifications...\n");

    // 1. Add client_id column to email_classifications
    console.log("1. Adding client_id column...");
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'email_classifications'
          AND column_name = 'client_id'
        ) THEN
          ALTER TABLE email_classifications
          ADD COLUMN client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    console.log("   ✓ client_id column added\n");

    // 2. Create index for faster lookups
    console.log("2. Creating index for client_id...");
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_email_classifications_client_id
      ON email_classifications(client_id);
    `);
    console.log("   ✓ Index created\n");

    // 3. Add matched_at timestamp column
    console.log("3. Adding matched_at column...");
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'email_classifications'
          AND column_name = 'matched_at'
        ) THEN
          ALTER TABLE email_classifications
          ADD COLUMN matched_at TIMESTAMPTZ;
        END IF;
      END $$;
    `);
    console.log("   ✓ matched_at column added\n");

    // 4. Add match_method column (auto/manual/email/phone)
    console.log("4. Adding match_method column...");
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'email_classifications'
          AND column_name = 'match_method'
        ) THEN
          ALTER TABLE email_classifications
          ADD COLUMN match_method VARCHAR(50);
        END IF;
      END $$;
    `);
    console.log("   ✓ match_method column added\n");

    // 5. Create a view for unified client communications
    console.log("5. Creating unified communications view...");
    await client.query(`
      CREATE OR REPLACE VIEW client_communications_unified AS
      SELECT
        'call' as communication_type,
        c.id as record_id,
        c.client_id,
        c.created_at,
        c.direction,
        c.caller_phone as contact_info,
        c.caller_name as contact_name,
        c.summary,
        c.duration as duration_seconds,
        c.recording_url,
        c.transcription as content,
        c.sentiment,
        c.intent as category,
        NULL::TEXT as email_message_id
      FROM calls c
      WHERE c.client_id IS NOT NULL

      UNION ALL

      SELECT
        'email' as communication_type,
        ec.id as record_id,
        ec.client_id,
        ec.created_at,
        'inbound' as direction,
        NULL as contact_info,
        NULL as contact_name,
        ec.summary,
        NULL as duration_seconds,
        NULL as recording_url,
        NULL as content,
        ec.sentiment,
        ec.category,
        ec.email_message_id
      FROM email_classifications ec
      WHERE ec.client_id IS NOT NULL

      ORDER BY created_at DESC;
    `);
    console.log("   ✓ Unified communications view created\n");

    // 6. Create a function to auto-match communications to clients
    console.log("6. Creating auto-match function...");
    await client.query(`
      CREATE OR REPLACE FUNCTION match_communication_to_client(
        p_phone VARCHAR(20) DEFAULT NULL,
        p_email VARCHAR(255) DEFAULT NULL
      )
      RETURNS UUID AS $$
      DECLARE
        matched_client_id UUID;
      BEGIN
        -- Try to match by phone first
        IF p_phone IS NOT NULL THEN
          -- Normalize phone number (remove non-digits)
          SELECT id INTO matched_client_id
          FROM clients
          WHERE
            regexp_replace(phone, '[^0-9]', '', 'g') = regexp_replace(p_phone, '[^0-9]', '', 'g')
            OR regexp_replace(alternate_phone, '[^0-9]', '', 'g') = regexp_replace(p_phone, '[^0-9]', '', 'g')
          LIMIT 1;

          IF matched_client_id IS NOT NULL THEN
            RETURN matched_client_id;
          END IF;
        END IF;

        -- Try to match by email
        IF p_email IS NOT NULL THEN
          SELECT id INTO matched_client_id
          FROM clients
          WHERE LOWER(email) = LOWER(p_email)
          LIMIT 1;

          IF matched_client_id IS NOT NULL THEN
            RETURN matched_client_id;
          END IF;

          -- Also check client_contacts table
          SELECT client_id INTO matched_client_id
          FROM client_contacts
          WHERE LOWER(email) = LOWER(p_email)
          LIMIT 1;

          IF matched_client_id IS NOT NULL THEN
            RETURN matched_client_id;
          END IF;
        END IF;

        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log("   ✓ Auto-match function created\n");

    console.log("========================================");
    console.log("Migration completed successfully!");
    console.log("========================================\n");

    console.log("Changes made:");
    console.log("  - Added client_id column to email_classifications");
    console.log("  - Added matched_at and match_method columns");
    console.log("  - Created index for client_id");
    console.log("  - Created unified communications view");
    console.log("  - Created match_communication_to_client function");

  } catch (error) {
    console.error("Error during migration:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addClientIdToClassifications();
