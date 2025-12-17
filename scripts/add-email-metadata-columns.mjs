/**
 * Add email metadata columns to email_classifications table
 * This stores sender name, email, subject, and other metadata
 * so we don't need to re-fetch from Microsoft Graph
 */

import pg from "pg";
const { Client } = pg;

const client = new Client({
  connectionString:
    "postgresql://postgres:ttandSellaBella1234@db.cyygkhwujcrbhzgjqipj.supabase.co:5432/postgres",
  ssl: { rejectUnauthorized: false },
});

async function addColumns() {
  await client.connect();
  console.log("Connected to database...");

  try {
    console.log("Adding email metadata columns to email_classifications...");

    // Add sender_name column
    await client.query(`
      ALTER TABLE public.email_classifications
      ADD COLUMN IF NOT EXISTS sender_name VARCHAR(255);
    `);
    console.log("Added sender_name column");

    // Add sender_email column
    await client.query(`
      ALTER TABLE public.email_classifications
      ADD COLUMN IF NOT EXISTS sender_email VARCHAR(255);
    `);
    console.log("Added sender_email column");

    // Add subject column
    await client.query(`
      ALTER TABLE public.email_classifications
      ADD COLUMN IF NOT EXISTS subject TEXT;
    `);
    console.log("Added subject column");

    // Add has_attachments column
    await client.query(`
      ALTER TABLE public.email_classifications
      ADD COLUMN IF NOT EXISTS has_attachments BOOLEAN DEFAULT false;
    `);
    console.log("Added has_attachments column");

    // Add received_at column (original email received time)
    await client.query(`
      ALTER TABLE public.email_classifications
      ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;
    `);
    console.log("Added received_at column");

    // Add index on sender_email for filtering/searching
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_classifications_sender_email
      ON public.email_classifications(sender_email);
    `);
    console.log("Added index on sender_email");

    // Add index on received_at for sorting
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_classifications_received_at
      ON public.email_classifications(received_at DESC);
    `);
    console.log("Added index on received_at");

    console.log("\nAll columns added successfully!");

  } catch (error) {
    console.error("Error adding columns:", error);
    throw error;
  } finally {
    await client.end();
  }
}

addColumns();
