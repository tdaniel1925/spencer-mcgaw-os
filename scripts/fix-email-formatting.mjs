import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixEmails() {
  console.log('🔧 Deleting badly formatted emails...\n');

  // Delete all email_messages that have raw MIME content in body_text
  const { data: badEmails, error: fetchError } = await supabase
    .from('email_messages')
    .select('id, subject, body_text')
    .like('body_text', '%Content-Type:%');

  if (fetchError) {
    console.error('❌ Error fetching emails:', fetchError);
    process.exit(1);
  }

  const count = badEmails ? badEmails.length : 0;
  console.log(`Found ${count} badly formatted emails`);

  if (badEmails && badEmails.length > 0) {
    const ids = badEmails.map(e => e.id);

    const { error: deleteError } = await supabase
      .from('email_messages')
      .delete()
      .in('id', ids);

    if (deleteError) {
      console.error('❌ Error deleting emails:', deleteError);
      process.exit(1);
    }

    console.log(`✅ Deleted ${badEmails.length} emails`);
  }

  console.log('\n✅ Done! Now trigger a manual sync to re-import with proper formatting.');
  console.log('Run: curl -X POST http://localhost:2900/api/cron/sync-emails');
}

fixEmails().then(() => process.exit(0));
