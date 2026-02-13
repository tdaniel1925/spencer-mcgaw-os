/**
 * Email Polling Watcher
 * Polls the sync API every 30 seconds for new emails
 * Works with production by calling the API endpoint
 *
 * Run: node scripts/email-polling-watcher.mjs
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local
dotenv.config({ path: join(__dirname, '..', '.env.local') });

// Use production URL or fallback to localhost
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://spencer-mcgaw-hub.vercel.app';
const pollInterval = 30000; // 30 seconds

console.log('🚀 Starting email polling watcher...');
console.log(`📡 API: ${baseUrl}/api/email/fastmail-sync`);
console.log(`⏱️  Poll interval: ${pollInterval / 1000} seconds\n`);

let consecutiveErrors = 0;
const maxConsecutiveErrors = 5;

async function syncEmails() {
  try {
    console.log(`🔄 [${new Date().toLocaleTimeString()}] Syncing emails...`);

    const response = await fetch(`${baseUrl}/api/email/fastmail-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(25000), // 25 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Sync failed (${response.status}):`, errorText.substring(0, 200));
      consecutiveErrors++;

      if (consecutiveErrors >= maxConsecutiveErrors) {
        console.error(`\n💀 Too many consecutive errors (${maxConsecutiveErrors}). Stopping watcher.`);
        console.error('Please check:');
        console.error('1. Fastmail connection is active in Settings');
        console.error('2. App password is correct');
        console.error('3. IMAP access is enabled in Fastmail');
        process.exit(1);
      }
      return;
    }

    const data = await response.json();
    consecutiveErrors = 0; // Reset on success

    if (data.totalEmailsProcessed > 0) {
      console.log(`✅ [${new Date().toLocaleTimeString()}] Synced ${data.totalEmailsProcessed} new email(s)!`);
      console.log(`   👥 Users: ${data.usersSynced}`);

      if (data.errors && data.errors.length > 0) {
        console.warn(`   ⚠️  Errors: ${data.errors.length}`);
        data.errors.forEach(err => console.warn(`      - ${err}`));
      }
    } else {
      console.log(`✓ [${new Date().toLocaleTimeString()}] No new emails`);
    }

  } catch (error) {
    console.error(`❌ [${new Date().toLocaleTimeString()}] Error:`, error.message);
    consecutiveErrors++;

    if (error.name === 'AbortError') {
      console.error('   Sync timed out after 25 seconds');
    }

    if (consecutiveErrors >= maxConsecutiveErrors) {
      console.error(`\n💀 Too many consecutive errors (${maxConsecutiveErrors}). Stopping watcher.`);
      console.error('Possible issues:');
      console.error('1. API server is down');
      console.error('2. Network connectivity issues');
      console.error('3. NEXT_PUBLIC_APP_URL is incorrect');
      process.exit(1);
    }
  }
}

// Initial sync on startup
console.log('📬 Running initial sync...\n');
await syncEmails();

// Then poll every 30 seconds
console.log(`\n✅ Polling started - checking every ${pollInterval / 1000} seconds`);
console.log('Press Ctrl+C to stop\n');

const intervalId = setInterval(syncEmails, pollInterval);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down email watcher...');
  clearInterval(intervalId);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 Shutting down email watcher...');
  clearInterval(intervalId);
  process.exit(0);
});
