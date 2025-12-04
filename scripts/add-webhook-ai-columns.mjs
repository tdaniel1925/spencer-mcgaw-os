/**
 * Migration script to add AI summary columns to webhook_logs table
 * Run with: node scripts/add-webhook-ai-columns.mjs
 */

import dotenv from "dotenv";
import pg from "pg";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

const { Pool } = pg;

async function addWebhookAIColumns() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log("Adding AI columns to webhook_logs table...");

    // Add ai_summary column if it doesn't exist
    await pool.query(`
      ALTER TABLE webhook_logs
      ADD COLUMN IF NOT EXISTS ai_summary TEXT;
    `);
    console.log("✓ Added ai_summary column");

    // Add ai_category column if it doesn't exist
    await pool.query(`
      ALTER TABLE webhook_logs
      ADD COLUMN IF NOT EXISTS ai_category VARCHAR(50);
    `);
    console.log("✓ Added ai_category column");

    console.log("✅ Migration completed successfully!");

  } catch (error) {
    console.error("❌ Error adding columns:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

addWebhookAIColumns();
