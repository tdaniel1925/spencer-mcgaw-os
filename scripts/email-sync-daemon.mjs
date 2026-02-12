/**
 * Email Sync Daemon
 * Continuously syncs emails from Fastmail every 5 minutes
 *
 * Run: node scripts/email-sync-daemon.mjs
 */

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const API_URL = 'http://localhost:2900/api/cron/sync-emails';

let syncCount = 0;

async function syncEmails() {
  try {
    console.log(`\n[${new Date().toLocaleTimeString()}] Starting email sync #${++syncCount}...`);

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Sync complete:`);
      console.log(`   - Users synced: ${data.usersSynced}`);
      console.log(`   - Emails processed: ${data.totalEmailsProcessed}`);
      if (data.errors.length > 0) {
        console.log(`   - Errors: ${data.errors.length}`);
        data.errors.forEach(err => console.log(`     • ${err}`));
      }
    } else {
      const error = await response.json();
      console.error(`❌ Sync failed: ${error.error || error.message}`);
    }
  } catch (error) {
    console.error(`❌ Error syncing emails:`, error.message);
  }
}

// Run initial sync
console.log('📧 Email Sync Daemon Started');
console.log(`⏱️  Syncing every ${SYNC_INTERVAL_MS / 1000 / 60} minutes`);
console.log(`🔗 API: ${API_URL}\n`);

syncEmails();

// Set up interval
setInterval(syncEmails, SYNC_INTERVAL_MS);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Email sync daemon stopped');
  process.exit(0);
});
