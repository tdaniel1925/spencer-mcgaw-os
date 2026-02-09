#!/usr/bin/env node

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { Client } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ Missing DATABASE_URL in .env.local');
  process.exit(1);
}

async function applyMigration() {
  const client = new Client({
    connectionString: databaseUrl,
  });

  console.log('🔌 Connecting to database...');
  await client.connect();
  console.log('✅ Connected');

  console.log('\n🔄 Reading migration file...');
  const migrationPath = join(__dirname, '../drizzle/0000_freezing_mantis.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf-8');

  console.log('📊 Migration file loaded');
  console.log(`📏 Size: ${(migrationSQL.length / 1024).toFixed(2)} KB`);

  console.log('\n🚀 Applying migration as single transaction...');

  try {
    await client.query('BEGIN');

    // Execute the entire migration as one statement
    // PostgreSQL can handle multiple statements separated by semicolons
    await client.query(migrationSQL);

    await client.query('COMMIT');

    console.log('\n✅ Migration applied successfully!');
    console.log('\n📋 Summary:');
    console.log('   - All tables created');
    console.log('   - All enums created');
    console.log('   - All foreign keys added');
    console.log('   - All constraints applied');

  } catch (error) {
    await client.query('ROLLBACK');

    console.error('\n❌ Migration failed:', error.message);
    console.log('\n💡 Common issues:');
    console.log('   - Tables or enums may already exist');
    console.log('   - Check database permissions');
    console.log('   - Verify DATABASE_URL is correct');

    if (error.message.includes('already exists')) {
      console.log('\n⚠️  Some objects already exist. This is usually safe to ignore.');
      console.log('   Your database may already be partially migrated.');
    }

    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

applyMigration().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
