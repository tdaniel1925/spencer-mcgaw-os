import fetch from 'node-fetch';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

console.log('🔄 Testing Fastmail email sync...\n');
console.log(`Endpoint: ${baseUrl}/api/email/fastmail-sync\n`);

try {
  console.log('Sending POST request to trigger sync...');

  const response = await fetch(`${baseUrl}/api/email/fastmail-sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  console.log(`Status: ${response.status} ${response.statusText}\n`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Sync failed:');
    console.error(errorText);
    process.exit(1);
  }

  const data = await response.json();

  console.log('✅ Sync completed successfully!\n');
  console.log('📊 Results:');
  console.log(`   Users Synced: ${data.usersSynced || 0}`);
  console.log(`   Total Emails Processed: ${data.totalEmailsProcessed || 0}`);

  if (data.details && Array.isArray(data.details)) {
    console.log('\n📧 Details by connection:');
    for (const detail of data.details) {
      console.log(`\n   Connection: ${detail.connectionEmail || 'Unknown'}`);
      console.log(`   - New emails: ${detail.newEmails || 0}`);
      console.log(`   - Tasks created: ${detail.tasksCreated || 0}`);
      if (detail.error) {
        console.log(`   - ❌ Error: ${detail.error}`);
      }
    }
  }

  if (data.totalEmailsProcessed === 0) {
    console.log('\n⚠️  No emails were processed. Possible reasons:');
    console.log('   1. No unread emails in inbox');
    console.log('   2. Connection is inactive (check with check-fastmail-connection.mjs)');
    console.log('   3. IMAP credentials are incorrect');
    console.log('   4. All emails were already synced');
  } else {
    console.log(`\n✅ Successfully processed ${data.totalEmailsProcessed} email(s)!`);
  }

} catch (error) {
  console.error('❌ Error testing sync:');
  console.error(error.message);

  if (error.code === 'ECONNREFUSED') {
    console.error('\n⚠️  Could not connect to app. Make sure:');
    console.error('   1. Development server is running (npm run dev)');
    console.error('   2. NEXT_PUBLIC_APP_URL is set correctly');
    console.error(`   3. App is accessible at: ${baseUrl}`);
  }

  process.exit(1);
}
