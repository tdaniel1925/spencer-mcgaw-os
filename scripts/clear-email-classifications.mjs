/**
 * Clear existing email classifications so they can be re-synced
 * with the new metadata columns (sender_name, sender_email, subject, etc.)
 *
 * This is a one-time script to re-process existing emails with AI
 * and store the email metadata for display purposes.
 */

import pg from "pg";
const { Client } = pg;

const client = new Client({
  connectionString:
    "postgresql://postgres:ttandSellaBella1234@db.cyygkhwujcrbhzgjqipj.supabase.co:5432/postgres",
  ssl: { rejectUnauthorized: false },
});

async function clearClassifications() {
  await client.connect();
  console.log("Connected to database...");

  try {
    // First, count existing records
    const countResult = await client.query(`
      SELECT COUNT(*) as count FROM public.email_classifications;
    `);
    console.log(`Found ${countResult.rows[0].count} email classifications`);

    if (countResult.rows[0].count === '0') {
      console.log("No classifications to clear.");
      return;
    }

    // Delete action items first (foreign key constraint)
    console.log("Deleting email_action_items...");
    const actionItemsResult = await client.query(`
      DELETE FROM public.email_action_items;
    `);
    console.log(`Deleted ${actionItemsResult.rowCount} action items`);

    // Delete classifications
    console.log("Deleting email_classifications...");
    const classificationsResult = await client.query(`
      DELETE FROM public.email_classifications;
    `);
    console.log(`Deleted ${classificationsResult.rowCount} classifications`);

    console.log("\nDone! Run 'Sync & Process' on the Email Intelligence page to re-sync emails with metadata.");

  } catch (error) {
    console.error("Error clearing classifications:", error);
    throw error;
  } finally {
    await client.end();
  }
}

clearClassifications();
