#!/usr/bin/env node
/**
 * Quick migration runner - applies foundation tables migration
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env vars from .env.local
config({ path: join(__dirname, '../.env.local') });

// Get env vars
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  console.log('📦 Reading migration file...');

  const migrationPath = join(__dirname, '../supabase/migrations/20251227_foundation_tables.sql');
  const sql = readFileSync(migrationPath, 'utf-8');

  console.log('🚀 Applying migration to Supabase...');
  console.log(`   URL: ${SUPABASE_URL}`);

  try {
    // Run the SQL using Supabase client
    const { error } = await supabase.rpc('exec_sql', { sql_string: sql });

    if (error) {
      // If rpc doesn't exist, try direct SQL via Postgres connection
      console.log('⚠️  RPC method not available, using direct connection...');

      // Use postgres connection directly
      const { Client } = await import('pg');
      const DATABASE_URL = process.env.DATABASE_URL;

      if (!DATABASE_URL) {
        throw new Error('DATABASE_URL not found in environment');
      }

      const client = new Client({ connectionString: DATABASE_URL });
      await client.connect();

      await client.query(sql);
      await client.end();

      console.log('✅ Migration applied successfully via direct connection!');
    } else {
      console.log('✅ Migration applied successfully!');
    }

    // Verify email_connections table exists
    const { data, error: checkError } = await supabase
      .from('email_connections')
      .select('count')
      .limit(1);

    if (checkError) {
      console.log('⚠️  Warning: Could not verify table creation:', checkError.message);
    } else {
      console.log('✅ Verified: email_connections table exists');
    }

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

runMigration();
