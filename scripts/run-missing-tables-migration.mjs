#!/usr/bin/env node

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function applyMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  console.log('🔌 Connecting to database...');
  await client.connect();
  console.log('✅ Connected\n');

  console.log('🔄 Reading migration file...');
  const migrationPath = join(__dirname, 'add-missing-tables.sql');
  const sql = readFileSync(migrationPath, 'utf-8');

  console.log('📊 Migration loaded');
  console.log('🚀 Applying missing tables...\n');

  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');

    console.log('✅ Migration completed successfully!\n');
    console.log('📋 Added tables:');
    console.log('   - task_handoff_history');
    console.log('   - task_pools');
    console.log('   - task_recurrence');
    console.log('   - email_threads');
    console.log('   - email_messages');
    console.log('   - email_attachments');
    console.log('   - email_sync_state');
    console.log('   - email_ai_insights');
    console.log('\n🏷️  Added enums:');
    console.log('   - email_category, email_folder, email_importance');
    console.log('   - email_intent, email_provider, email_sentiment');
    console.log('   - folder_type, permission, share_permission');
    console.log('   - share_type, sync_status, webhook_sub_status');
    console.log('\n🎉 Database schema is now complete!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);

    if (error.message.includes('already exists')) {
      console.log('\n⚠️  Some tables already exist. Re-checking schema...');
      // Run check again
      const checkResult = await client.query(`
        SELECT COUNT(*) as count FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN (
          'task_handoff_history', 'task_pools', 'task_recurrence',
          'email_threads', 'email_messages', 'email_attachments',
          'email_sync_state', 'email_ai_insights'
        )
      `);
      console.log(`   ${checkResult.rows[0].count}/8 tables exist`);

      if (checkResult.rows[0].count === '8') {
        console.log('   ✅ All tables now exist!');
      }
    }
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

applyMigration().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
