import 'dotenv/config';
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

async function clearAllData() {
  try {
    console.log('🗑️  Clearing all data (keeping users)...\n');

    // Tables to clear (in order to respect foreign key constraints)
    const tablesToClear = [
      // Activity and logs
      'activity_logs',

      // Email related
      'email_messages',
      'email_threads',
      'email_sync_state',
      'email_connections',
      'potential_tasks',
      'processed_emails',
      'email_classifications',
      'email_training_data',

      // Tasks
      'task_comments',
      'tasks',
      'task_files',

      // Calls and communications
      'call_recordings',
      'calls',
      'sms_messages',
      'vapi_calls',

      // Documents and files
      'documents',
      'files',

      // Clients and contacts
      'contacts',
      'clients',

      // Calendar
      'calendar_events',

      // Chat
      'chat_messages',
      'chat_rooms',
      'chat_presence',

      // Webhooks
      'webhook_logs',

      // Other
      'notifications',
      'sender_rules',
    ];

    let totalDeleted = 0;

    for (const table of tablesToClear) {
      try {
        const result = await sql`
          DELETE FROM ${sql(table)}
        `;
        const count = result.count || 0;
        if (count > 0) {
          console.log(`✅ Deleted ${count} records from ${table}`);
          totalDeleted += count;
        } else {
          console.log(`⚪ ${table} was already empty`);
        }
      } catch (error) {
        if (error.message.includes('does not exist')) {
          console.log(`⚠️  Table ${table} does not exist (skipping)`);
        } else {
          console.error(`❌ Error clearing ${table}:`, error.message);
        }
      }
    }

    console.log(`\n🎉 Cleanup complete! Deleted ${totalDeleted} total records`);
    console.log('✅ Users and authentication data preserved');

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

clearAllData();
