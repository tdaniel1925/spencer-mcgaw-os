#!/usr/bin/env node
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../.env.local'), quiet: true });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    db: { schema: 'public' }
  }
);

async function addColumns() {
  console.log('🔧 Adding missing columns to email_connections...\n');

  const alterStatements = [
    `ALTER TABLE email_connections ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;`,
    `ALTER TABLE email_connections ADD COLUMN IF NOT EXISTS sync_enabled BOOLEAN NOT NULL DEFAULT true;`,
    `ALTER TABLE email_connections ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT false;`,
    `ALTER TABLE email_connections ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;`,
    `ALTER TABLE email_connections ADD COLUMN IF NOT EXISTS description TEXT;`,
    `ALTER TABLE email_connections ADD COLUMN IF NOT EXISTS error_message TEXT;`,
    `ALTER TABLE email_connections ADD COLUMN IF NOT EXISTS sync_from_date DATE;`,
  ];

  try {
    for (const sql of alterStatements) {
      console.log(`  Executing: ${sql.substring(0, 60)}...`);

      const { error } = await supabase.rpc('exec', { sql });

      if (error) {
        console.log(`    ⚠️  Using alternative method...`);
        // Supabase doesn't allow DDL via RPC, we need to tell user to run manually
      }
    }

    console.log('\n📋 Please run these SQL statements in Supabase SQL Editor:');
    console.log('   https://supabase.com/dashboard/project/cyygkhwujcrbhzgjqipj/sql\n');

    alterStatements.forEach(stmt => console.log(stmt));

    console.log('\n   OR copy the full migration from:');
    console.log('   supabase/migrations/20251227_foundation_tables.sql');

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

addColumns();
