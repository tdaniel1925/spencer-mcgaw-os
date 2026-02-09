#!/usr/bin/env node
/**
 * Reset All Data Except Users
 *
 * This script will DELETE ALL DATA except:
 * - users table
 * - organizations table (if you want to keep it)
 *
 * Everything else will be PERMANENTLY DELETED:
 * - All tasks, clients, calls, emails, files, etc.
 */

import pg from 'pg';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '..', '.env.local') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Helper to confirm action
function confirm(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

async function resetData() {
  const client = await pool.connect();

  try {
    console.log('\n⚠️  WARNING: This will DELETE ALL DATA except users!\n');
    console.log('The following will be PERMANENTLY DELETED:');
    console.log('  ❌ All tasks and task assignments');
    console.log('  ❌ All potential tasks (AI suggestions)');
    console.log('  ❌ All clients and client data');
    console.log('  ❌ All calls and call summaries');
    console.log('  ❌ All emails and email classifications');
    console.log('  ❌ All projects');
    console.log('  ❌ All files and folders');
    console.log('  ❌ All activities and audit logs');
    console.log('  ❌ All webhooks and notifications');
    console.log('  ❌ All chat messages\n');
    console.log('Only USERS will be preserved.\n');

    const confirmed = await confirm('Type "yes" to confirm deletion: ');

    if (!confirmed) {
      console.log('\n✅ Cancelled. No data was deleted.');
      return;
    }

    console.log('\n🗑️  Starting data deletion...\n');

    await client.query('BEGIN');

    // Count before deletion
    const beforeCounts = await client.query(`
      SELECT 'tasks' as table_name, COUNT(*)::int as count FROM tasks
      UNION ALL SELECT 'clients', COUNT(*)::int FROM clients
      UNION ALL SELECT 'calls', COUNT(*)::int FROM calls
      UNION ALL SELECT 'potential_tasks', COUNT(*)::int FROM potential_tasks
      UNION ALL SELECT 'email_classifications', COUNT(*)::int FROM email_classifications
      UNION ALL SELECT 'activities', COUNT(*)::int FROM activities
      UNION ALL SELECT 'files', COUNT(*)::int FROM files
    `);

    console.log('📊 Data before deletion:');
    beforeCounts.rows.forEach(row => {
      console.log(`   ${row.table_name}: ${row.count}`);
    });
    console.log('');

    // Delete in dependency order
    const deletions = [
      { name: 'Potential tasks', query: 'DELETE FROM potential_tasks' },
      { name: 'Task assignments', query: 'DELETE FROM task_assignments' },
      { name: 'Task comments', query: 'DELETE FROM task_comments' },
      { name: 'Tasks', query: 'DELETE FROM tasks' },
      { name: 'Call summaries', query: 'DELETE FROM call_summaries' },
      { name: 'Calls', query: 'DELETE FROM calls' },
      { name: 'Email action items', query: 'DELETE FROM email_action_items' },
      { name: 'Email classifications', query: 'DELETE FROM email_classifications' },
      { name: 'Email accounts', query: 'DELETE FROM email_accounts' },
      { name: 'Project members', query: 'DELETE FROM project_members' },
      { name: 'Projects', query: 'DELETE FROM projects' },
      { name: 'Client notes', query: 'DELETE FROM client_notes' },
      { name: 'Clients', query: 'DELETE FROM clients' },
      { name: 'Activities', query: 'DELETE FROM activities' },
      { name: 'Audit logs', query: 'DELETE FROM audit_logs' },
      { name: 'File shares', query: 'DELETE FROM file_shares' },
      { name: 'File versions', query: 'DELETE FROM file_versions' },
      { name: 'File activity', query: 'DELETE FROM file_activity' },
      { name: 'Files', query: 'DELETE FROM files' },
      { name: 'Folder permissions', query: 'DELETE FROM folder_permissions' },
      { name: 'Folders', query: 'DELETE FROM folders' },
      { name: 'Webhook logs', query: 'DELETE FROM webhook_logs' },
      { name: 'Notifications', query: 'DELETE FROM notifications' },
      { name: 'Chat messages', query: 'DELETE FROM chat_messages' },
      { name: 'Chat channels', query: 'DELETE FROM chat_channels' },
      { name: 'User activity', query: 'DELETE FROM user_activity' },
    ];

    for (const deletion of deletions) {
      try {
        const result = await client.query(deletion.query);
        console.log(`   ✓ Deleted ${deletion.name}: ${result.rowCount || 0} rows`);
      } catch (err) {
        // Table might not exist, that's OK
        console.log(`   ⚠ ${deletion.name}: ${err.message}`);
      }
    }

    await client.query('COMMIT');

    // Count after deletion
    console.log('\n✅ Deletion complete!\n');

    const afterCounts = await client.query(`
      SELECT 'users' as table_name, COUNT(*)::int as count FROM users
      UNION ALL SELECT 'organizations', COUNT(*)::int FROM organizations
      UNION ALL SELECT 'tasks', COUNT(*)::int FROM tasks
      UNION ALL SELECT 'clients', COUNT(*)::int FROM clients
      UNION ALL SELECT 'calls', COUNT(*)::int FROM calls
      UNION ALL SELECT 'potential_tasks', COUNT(*)::int FROM potential_tasks
    `);

    console.log('📊 Final state:');
    afterCounts.rows.forEach(row => {
      console.log(`   ${row.table_name}: ${row.count}`);
    });
    console.log('\n✨ Database reset complete! Only users remain.\n');

  } catch (err) {
    await client.query('ROLLBACK');
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
