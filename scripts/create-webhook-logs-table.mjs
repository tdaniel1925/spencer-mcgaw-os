/**
 * Migration script to create the webhook_logs table
 * Run with: node scripts/create-webhook-logs-table.mjs
 */

import dotenv from "dotenv";
import pg from "pg";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

const { Pool } = pg;

async function createWebhookLogsTable() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log("Creating webhook_status enum and webhook_logs table...");

    // Create enum type if it doesn't exist
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE webhook_status AS ENUM ('received', 'parsing', 'parsed', 'stored', 'failed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create webhook_logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS webhook_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        endpoint VARCHAR(100) NOT NULL,
        source VARCHAR(100),
        status webhook_status NOT NULL DEFAULT 'received',
        http_method VARCHAR(10) NOT NULL DEFAULT 'POST',
        headers JSONB DEFAULT '{}',
        raw_payload JSONB DEFAULT '{}',
        parsed_data JSONB,
        ai_parsing_used BOOLEAN DEFAULT FALSE,
        ai_confidence INTEGER,
        error_message TEXT,
        error_stack TEXT,
        processing_time_ms INTEGER,
        result_call_id UUID REFERENCES calls(id),
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Create indexes for common queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(status);
      CREATE INDEX IF NOT EXISTS idx_webhook_logs_endpoint ON webhook_logs(endpoint);
      CREATE INDEX IF NOT EXISTS idx_webhook_logs_result_call_id ON webhook_logs(result_call_id);
    `);

    console.log("✅ webhook_logs table created successfully!");
    console.log("   - Created webhook_status enum");
    console.log("   - Created webhook_logs table");
    console.log("   - Created indexes");

  } catch (error) {
    console.error("❌ Error creating webhook_logs table:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

createWebhookLogsTable();
