#!/usr/bin/env node
/**
 * Reset All Data Except Users - AUTO-CONFIRMED
 *
 * This version runs without confirmation prompts.
 * Use with caution!
 */

import pg from 'pg';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '..', '.env.local') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function resetData() {
  const client = await pool.connect();

  try {
    console.log('\n🗑️  RESETTING ALL DATA EXCEPT USERS...\n');

    // Count before deletion (with error handling)
    console.log('📊 Data before deletion:');
    const tablesToCount = ['tasks', 'clients', 'calls', 'potential_tasks', 'files'];
    for (const table of tablesToCount) {
      try {
        const result = await client.query(`SELECT COUNT(*)::int as count FROM ${table}`);
        console.log(`   ${table}: ${result.rows[0].count}`);
      } catch (err) {
        // Table doesn't exist, skip it
      }
    }
    console.log('');

    // Delete in dependency order (NO TRANSACTION - handle each table independently)
    const deletions = [
      'potential_tasks',
      'task_assignments',
      'task_comments',
      'tasks',
      'call_summaries',
      'calls',
      'email_action_items',
      'email_classifications',
      'email_accounts',
      'project_members',
      'projects',
      'client_notes',
      'clients',
      'activities',
      'audit_logs',
      'file_shares',
      'file_versions',
      'file_activity',
      'files',
      'folder_permissions',
      'folders',
      'webhook_logs',
      'notifications',
      'chat_messages',
      'chat_channels',
      'user_activity',
    ];

    let totalDeleted = 0;

    for (const table of deletions) {
      try {
        const result = await client.query(`DELETE FROM ${table}`);
        const count = result.rowCount || 0;
        if (count > 0) {
          console.log(`   ✓ ${table}: ${count} rows deleted`);
          totalDeleted += count;
        }
      } catch (err) {
        // Table might not exist, that's OK
        if (!err.message.includes('does not exist')) {
          console.log(`   ⚠ ${table}: ${err.message}`);
        }
      }
    }

    console.log(`\n✅ Deleted ${totalDeleted} total rows\n`);

    // Count after deletion
    const afterCounts = await client.query(`
      SELECT 'users' as table_name, COUNT(*)::int as count FROM users
      UNION ALL SELECT 'organizations', COUNT(*)::int FROM organizations
      UNION ALL SELECT 'tasks', COUNT(*)::int FROM tasks
      UNION ALL SELECT 'clients', COUNT(*)::int FROM clients
      UNION ALL SELECT 'calls', COUNT(*)::int FROM calls
      UNION ALL SELECT 'potential_tasks', COUNT(*)::int FROM potential_tasks
      UNION ALL SELECT 'files', COUNT(*)::int FROM files
      ORDER BY table_name
    `);

    console.log('📊 Final state:');
    afterCounts.rows.forEach(row => {
      const emoji = row.table_name === 'users' || row.table_name === 'organizations' ? '✅' : '🗑️';
      console.log(`   ${emoji} ${row.table_name}: ${row.count}`);
    });

    console.log('\n✨ Database reset complete!\n');

  } catch (err) {
    console.error('\n❌ Error resetting data:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

resetData().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
