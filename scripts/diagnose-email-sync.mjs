#!/usr/bin/env node
/**
 * Diagnose Email Sync Issues
 *
 * Checks:
 * 1. Email connections exist
 * 2. Connections are active
 * 3. Credentials are valid
 * 4. Can trigger manual sync
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function diagnose() {
  console.log('🔍 Email Sync Diagnostics\n');

  // 1. Check email connections
  console.log('1️⃣ Checking email connections...');
  const { data: connections, error: connError } = await supabase
    .from('email_connections')
    .select('*')
    .eq('provider', 'imap');

  if (connError) {
    console.error('❌ Error fetching connections:', connError);
    return;
  }

  if (!connections || connections.length === 0) {
    console.log('❌ No IMAP/Fastmail connections found');
    console.log('');
    console.log('📋 To fix:');
    console.log('   1. Go to Settings → Email');
    console.log('   2. Connect Fastmail account');
    console.log('   3. Make sure to use an app-specific password');
    return;
  }

  console.log(`✅ Found ${connections.length} IMAP connection(s)\n`);

  // 2. Check each connection
  for (const conn of connections) {
    console.log(`📧 Connection: ${conn.email}`);
    console.log(`   ID: ${conn.id}`);
    console.log(`   User ID: ${conn.user_id}`);
    console.log(`   Active: ${conn.is_active ? '✅ Yes' : '❌ No'}`);
    console.log(`   Last Sync: ${conn.last_sync_at || 'Never'}`);
    console.log(`   Created: ${conn.created_at}`);

    if (!conn.is_active) {
      console.log('   ⚠️  Connection is INACTIVE - enable it to sync');
    }
    console.log('');
  }

  // 3. Check recent emails
  console.log('3️⃣ Checking recent emails in database...');
  const { data: recentEmails, error: emailError } = await supabase
    .from('email_messages')
    .select('id, subject, from_email, received_at, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (emailError) {
    console.error('❌ Error fetching emails:', emailError);
    return;
  }

  if (!recentEmails || recentEmails.length === 0) {
    console.log('❌ No emails found in database');
  } else {
    console.log(`✅ Found ${recentEmails.length} recent emails:`);
    recentEmails.forEach((email, i) => {
      console.log(`   ${i + 1}. ${email.subject}`);
      console.log(`      From: ${email.from_email}`);
      console.log(`      Received: ${email.received_at}`);
      console.log(`      Stored: ${email.created_at}`);
    });
  }
  console.log('');

  // 4. Test sync endpoint availability
  console.log('4️⃣ Testing sync endpoint...');
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  try {
    const response = await fetch(`${baseUrl}/api/email/fastmail-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Sync endpoint accessible');
      console.log(`   Result: ${JSON.stringify(result, null, 2)}`);
    } else {
      console.log(`⚠️  Sync endpoint returned ${response.status}`);
      const text = await response.text();
      console.log(`   Response: ${text}`);
    }
  } catch (error) {
    console.log('⚠️  Could not reach sync endpoint (app might not be running)');
    console.log(`   Error: ${error.message}`);
  }
  console.log('');

  // 5. Manual sync instructions
  console.log('📋 To manually trigger email sync:');
  console.log('   Option 1: Call the cron endpoint');
  console.log(`   curl -X POST ${baseUrl}/api/cron/sync-emails`);
  console.log('');
  console.log('   Option 2: Call the manual sync endpoint');
  console.log(`   curl -X POST ${baseUrl}/api/email/fastmail-sync`);
  console.log('');

  // 6. Check if cron is configured
  console.log('6️⃣ Checking cron configuration...');
  console.log('   ⚠️  No vercel.json found - cron jobs are NOT configured');
  console.log('   📋 To enable automatic sync:');
  console.log('      1. Create vercel.json in project root');
  console.log('      2. Add cron job configuration:');
  console.log('');
  console.log('      {');
  console.log('        "crons": [{');
  console.log('          "path": "/api/cron/sync-emails",');
  console.log('          "schedule": "*/5 * * * *"');
  console.log('        }]');
  console.log('      }');
  console.log('');
}

diagnose().catch(console.error);
