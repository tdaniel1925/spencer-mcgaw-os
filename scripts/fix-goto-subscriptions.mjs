/**
 * Re-subscribe to GoTo call reports
 * Run this to fix missing call-reports subscription
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const GOTO_CLIENT_ID = process.env.GOTO_CLIENT_ID;
const GOTO_CLIENT_SECRET = process.env.GOTO_CLIENT_SECRET;
const GOTO_ACCOUNT_KEY = process.env.GOTO_ACCOUNT_KEY;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getTokens() {
  const { data } = await supabase
    .from('integrations')
    .select('access_token, refresh_token, channel_id')
    .eq('provider', 'goto')
    .single();
  return data;
}

async function gotoApiRequest(path, options = {}) {
  const tokens = await getTokens();
  if (!tokens?.access_token) {
    throw new Error('No access token');
  }

  const response = await fetch(`https://api.goto.com${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${tokens.access_token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GoTo API error ${response.status}: ${text}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function subscribeToCallReports(channelId) {
  console.log('Subscribing to call-reports...');

  const result = await gotoApiRequest('/call-events-report/v1/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      channelId,
      eventTypes: ['REPORT_SUMMARY'],
      accountKeys: [GOTO_ACCOUNT_KEY],
    }),
  });

  console.log('Call-reports subscription result:', result);
  return result;
}

async function subscribeToCallEvents(channelId) {
  console.log('Subscribing to call-events...');

  const result = await gotoApiRequest('/call-events/v1/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      channelId,
      accountKeys: [
        {
          id: GOTO_ACCOUNT_KEY,
          events: ['STARTING', 'ENDING', 'ACTIVE'],
        },
      ],
    }),
  });

  console.log('Call-events subscription result:', result);
  return result;
}

async function listSubscriptions() {
  console.log('\n=== Current Subscriptions ===');

  try {
    const events = await gotoApiRequest('/call-events/v1/subscriptions');
    console.log('Call-events subscriptions:', JSON.stringify(events, null, 2));
  } catch (e) {
    console.log('Call-events error:', e.message);
  }

  try {
    const reports = await gotoApiRequest('/call-events-report/v1/subscriptions');
    console.log('Call-reports subscriptions:', JSON.stringify(reports, null, 2));
  } catch (e) {
    console.log('Call-reports error:', e.message);
  }
}

async function deleteCallReportsSubscription() {
  console.log('Deleting existing call-reports subscription...');
  try {
    await gotoApiRequest(`/call-events-report/v1/subscriptions/${GOTO_ACCOUNT_KEY}`, {
      method: 'DELETE',
    });
    console.log('✅ Deleted existing call-reports subscription');
  } catch (e) {
    console.log('Delete result:', e.message);
  }
}

async function createNewChannel(webhookUrl) {
  console.log('Creating new webhook channel...');
  const result = await gotoApiRequest('/notification-channel/v1/channels', {
    method: 'POST',
    body: JSON.stringify({
      channelType: 'Webhook',
      webhookChannelData: {
        webhook: {
          url: webhookUrl,
        },
      },
    }),
  });
  console.log('New channel created:', result.channelId);
  return result;
}

async function deleteOldChannel(channelId) {
  console.log('Deleting old channel:', channelId);
  try {
    await gotoApiRequest(`/notification-channel/v1/channels/${channelId}`, {
      method: 'DELETE',
    });
    console.log('✅ Old channel deleted');
  } catch (e) {
    console.log('Delete channel result:', e.message);
  }
}

async function updateDatabase(channelId, webhookUrl) {
  const { error } = await supabase
    .from('integrations')
    .update({
      channel_id: channelId,
      webhook_url: webhookUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('provider', 'goto');

  if (error) {
    console.error('Failed to update database:', error);
  } else {
    console.log('✅ Database updated with new channel');
  }
}

async function main() {
  const tokens = await getTokens();
  const webhookUrl = 'https://spencer-mcgaw-os.vercel.app/api/webhooks/goto';

  console.log('Current Channel ID:', tokens?.channel_id);
  console.log('Account Key:', GOTO_ACCOUNT_KEY);
  console.log('Webhook URL:', webhookUrl);

  // Delete existing call-reports subscription first
  console.log('\n=== Step 1: Delete existing subscriptions ===');
  await deleteCallReportsSubscription();

  // Delete the old channel (this should cascade delete subscriptions)
  console.log('\n=== Step 2: Delete old channel ===');
  if (tokens?.channel_id) {
    await deleteOldChannel(tokens.channel_id);
  }

  // Wait a moment for cleanup
  await new Promise(r => setTimeout(r, 2000));

  // Create a completely new channel
  console.log('\n=== Step 3: Create new channel ===');
  const newChannel = await createNewChannel(webhookUrl);

  // Subscribe to call events
  console.log('\n=== Step 4: Subscribe to call events ===');
  try {
    await subscribeToCallEvents(newChannel.channelId);
    console.log('✅ Call-events subscription created!');
  } catch (e) {
    console.error('❌ Failed:', e.message);
  }

  // Subscribe to call reports
  console.log('\n=== Step 5: Subscribe to call reports ===');
  try {
    await subscribeToCallReports(newChannel.channelId);
    console.log('✅ Call-reports subscription created!');
  } catch (e) {
    console.error('❌ Failed:', e.message);
  }

  // Update database
  console.log('\n=== Step 6: Update database ===');
  await updateDatabase(newChannel.channelId, webhookUrl);

  console.log('\n✅ DONE! New channel set up. Try making a test call now.');
  console.log('New Channel ID:', newChannel.channelId);
}

main();
