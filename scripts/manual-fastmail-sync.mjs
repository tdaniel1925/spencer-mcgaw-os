/**
 * Manual Fastmail Email Sync - Direct Test
 * Calls the sync function directly without needing the dev server
 *
 * Usage: node scripts/manual-fastmail-sync.mjs
 */

import { syncAllFastmailAccounts } from '../src/lib/email/fastmail-sync.ts';

console.log('🔄 Starting manual Fastmail sync...\n');
console.log('This will fetch new emails from ALL active Fastmail accounts\n');

try {
  const result = await syncAllFastmailAccounts();

  console.log('\n📊 Sync Results:');
  console.log(`   Success: ${result.success ? '✅' : '❌'}`);
  console.log(`   Users Synced: ${result.usersSynced}`);
  console.log(`   Total Emails Processed: ${result.totalEmailsProcessed}`);
  console.log(`   Errors: ${result.errors.length}`);

  if (result.errors.length > 0) {
    console.log('\n❌ Errors encountered:');
    result.errors.forEach((error, i) => {
      console.log(`   ${i + 1}. ${error}`);
    });
  }

  if (result.totalEmailsProcessed === 0) {
    console.log('\n⚠️  No emails were processed. Possible reasons:');
    console.log('   1. No unread emails in Fastmail inbox');
    console.log('   2. All emails were already synced');
    console.log('   3. Connection is inactive (run check-fastmail-connection.mjs)');
    console.log('   4. IMAP credentials are incorrect');
    console.log('   5. IMAP connection failed (firewall/network issue)');
    console.log('\nTroubleshooting steps:');
    console.log('   - Send a test email to the Fastmail account');
    console.log('   - Verify the email is UNREAD in Fastmail');
    console.log('   - Run this script again');
    console.log('   - Check application logs for detailed errors');
  } else {
    console.log(`\n✅ Successfully synced ${result.totalEmailsProcessed} email(s)!`);
    console.log('   - Check the app\'s Inbound page to see them');
    console.log('   - Any emails with potential tasks will appear in AI Task Suggestions');
  }

  process.exit(result.success ? 0 : 1);
} catch (error) {
  console.error('\n❌ Sync failed with error:');
  console.error(error.message);
  console.error('\nStack trace:');
  console.error(error.stack);

  console.error('\nCommon issues:');
  console.error('   1. DATABASE_URL not set in .env.local');
  console.error('   2. IMAP connection failed (invalid password, firewall)');
  console.error('   3. Supabase service role key not set');
  console.error('   4. OpenAI API key not set (needed for AI analysis)');

  process.exit(1);
}
