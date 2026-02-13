import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🔍 Checking Fastmail/IMAP connections...\n');

const { data: connections, error } = await supabase
  .from('email_connections')
  .select('*')
  .eq('provider', 'imap');

if (error) {
  console.error('❌ Database error:', error);
  process.exit(1);
}

if (!connections || connections.length === 0) {
  console.log('❌ No IMAP/Fastmail connections found in database');
  console.log('\nPossible issues:');
  console.log('1. User hasn\'t connected Fastmail account yet');
  console.log('2. Connection was deleted');
  console.log('3. Provider is set to something other than "imap"');
  process.exit(1);
}

console.log(`✅ Found ${connections.length} IMAP connection(s):\n`);

for (const conn of connections) {
  const metadata = conn.metadata || {};
  const imapHost = metadata.imapHost || 'imap.fastmail.com';
  const imapPort = metadata.imapPort || 993;

  console.log(`📧 Connection ID: ${conn.id}`);
  console.log(`   Email: ${conn.email}`);
  console.log(`   User ID: ${conn.user_id}`);
  console.log(`   Status: ${conn.is_active ? '✅ ACTIVE' : '❌ INACTIVE'}`);
  console.log(`   Host: ${imapHost}${!metadata.imapHost ? ' (default)' : ''}`);
  console.log(`   Port: ${imapPort}${!metadata.imapPort ? ' (default)' : ''}`);
  console.log(`   Last Sync: ${conn.last_sync_at ? new Date(conn.last_sync_at).toLocaleString() : 'Never'}`);
  console.log(`   Sync Errors: ${conn.sync_errors || 0}`);
  console.log(`   Created: ${new Date(conn.created_at).toLocaleString()}`);

  if (!conn.is_active) {
    console.log('\n⚠️  CONNECTION IS INACTIVE - This is why emails aren\'t syncing!');
    console.log('   This could happen if:');
    console.log('   - Connection was manually disabled');
    console.log('   - Too many sync errors occurred (auto-disabled)');
    console.log('   - Authentication failed');
    console.log('\n   Fix: Re-enable in Settings or run:');
    console.log(`   UPDATE email_connections SET is_active = true WHERE id = '${conn.id}';`);
  }

  if (conn.sync_errors > 0) {
    console.log(`\n⚠️  ${conn.sync_errors} sync error(s) detected`);
    console.log('   Check application logs for details');
    console.log('   Common issues:');
    console.log('   - Invalid app password');
    console.log('   - IMAP access disabled in email provider');
    console.log('   - Network/firewall blocking IMAP connection');
  }

  console.log('');
}

console.log('\n📊 Summary:');
console.log(`   Total connections: ${connections.length}`);
console.log(`   Active: ${connections.filter(c => c.is_active).length}`);
console.log(`   Inactive: ${connections.filter(c => !c.is_active).length}`);
console.log(`   With errors: ${connections.filter(c => c.sync_errors > 0).length}`);

if (connections.every(c => !c.is_active)) {
  console.log('\n❌ All connections are inactive. No emails will sync until you re-enable at least one.');
} else if (connections.some(c => c.is_active)) {
  console.log('\n✅ At least one connection is active and should be syncing.');
  console.log('If emails still aren\'t appearing:');
  console.log('1. Check that the cron job is running (Vercel deployment needed)');
  console.log('2. Run: node scripts/test-fastmail-sync.mjs to test manually');
  console.log('3. Check for unread emails in the Fastmail inbox');
  console.log('4. Look at Vercel logs for sync job errors');
}
