#!/usr/bin/env node

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Client } = pg;

async function checkSchema() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  console.log('🔌 Connecting to database...');
  await client.connect();
  console.log('✅ Connected\n');

  // Check tables
  console.log('📋 Checking tables...');
  const tablesResult = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  console.log(`Found ${tablesResult.rows.length} tables:`);
  tablesResult.rows.forEach(row => {
    console.log(`   - ${row.table_name}`);
  });

  // Check enums
  console.log('\n🏷️  Checking enums...');
  const enumsResult = await client.query(`
    SELECT t.typname as enum_name
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    GROUP BY t.typname
    ORDER BY t.typname;
  `);

  console.log(`Found ${enumsResult.rows.length} enums:`);
  enumsResult.rows.forEach(row => {
    console.log(`   - ${row.enum_name}`);
  });

  // Expected tables from schema
  const expectedTables = [
    'users', 'clients', 'organizations', 'task_action_types', 'tasks',
    'subtasks', 'task_steps', 'task_notes', 'task_activity', 'task_activity_log',
    'task_links', 'task_attachments', 'task_handoff_history', 'ai_training_feedback',
    'task_visibility_rules', 'task_pools', 'task_recurrence', 'calls', 'documents',
    'activity_logs', 'calendar_events', 'folders', 'files', 'file_versions',
    'file_shares', 'folder_permissions', 'storage_quotas', 'file_activity',
    'email_connections', 'email_threads', 'email_messages', 'email_attachments',
    'email_sync_state', 'email_ai_insights', 'webhook_logs'
  ];

  const existingTables = new Set(tablesResult.rows.map(r => r.table_name));
  const missingTables = expectedTables.filter(t => !existingTables.has(t));

  console.log('\n🔍 Migration Status:');
  console.log(`   ✅ Existing tables: ${existingTables.size}/${expectedTables.length}`);
  if (missingTables.length > 0) {
    console.log(`   ❌ Missing tables: ${missingTables.length}`);
    console.log('\n📝 Missing tables:');
    missingTables.forEach(t => console.log(`   - ${t}`));
  } else {
    console.log('   🎉 All tables exist!');
  }

  await client.end();
}

checkSchema().catch(err => {
  console.error('💥 Error:', err.message);
  process.exit(1);
});
