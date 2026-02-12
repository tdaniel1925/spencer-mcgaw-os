import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function clearAllData() {
  try {
    console.log('🗑️  Clearing all data (keeping users)...\n');

    // Tables to clear (in order to respect foreign key constraints)
    const tablesToClear = [
      'activity_logs',
      'potential_tasks',
      'email_messages',
      'email_threads',
      'email_sync_state',
      'email_connections',
      'task_comments',
      'tasks',
      'calls',
      'sms_messages',
      'documents',
      'contacts',
      'clients',
      'calendar_events',
      'chat_messages',
      'chat_rooms',
      'notifications',
    ];

    let totalDeleted = 0;

    for (const table of tablesToClear) {
      try {
        const { error, count } = await supabase
          .from(table)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

        if (error) {
          console.log(`⚠️  Could not clear ${table}: ${error.message}`);
        } else {
          console.log(`✅ Cleared ${table}`);
          totalDeleted++;
        }
      } catch (error) {
        console.log(`⚠️  Error with ${table}: ${error.message}`);
      }
    }

    console.log(`\n🎉 Cleanup complete! Cleared ${totalDeleted} tables`);
    console.log('✅ Users and authentication data preserved');

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

clearAllData();
