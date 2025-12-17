import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Check webhook logs
  console.log('=== Recent GoTo Webhook Logs ===');
  const { data: webhooks, error: whErr } = await supabase
    .from('webhook_logs')
    .select('id, source, event_type, created_at, processing_status')
    .eq('source', 'goto')
    .order('created_at', { ascending: false })
    .limit(10);
  if (whErr) console.log('Error:', whErr.message);
  else if (webhooks?.length === 0) console.log('No GoTo webhooks received');
  else console.log(JSON.stringify(webhooks, null, 2));

  // Check calls
  console.log('\n=== Recent Calls ===');
  const { data: calls, error: callErr } = await supabase
    .from('calls')
    .select('id, caller_phone, caller_name, direction, call_started_at, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  if (callErr) console.log('Error:', callErr.message);
  else if (calls?.length === 0) console.log('No calls in database');
  else console.log(JSON.stringify(calls, null, 2));

  // Check integration
  console.log('\n=== GoTo Integration ===');
  const { data: integ, error: intErr } = await supabase
    .from('integrations')
    .select('provider, channel_id, webhook_url, error_message, updated_at')
    .eq('provider', 'goto')
    .single();
  if (intErr) console.log('Error:', intErr.message);
  else console.log(JSON.stringify(integ, null, 2));

  // Count total webhooks by source
  console.log('\n=== Webhook Counts by Source ===');
  const { data: counts, error: countErr } = await supabase
    .from('webhook_logs')
    .select('source')
    .order('created_at', { ascending: false })
    .limit(100);
  if (countErr) console.log('Error:', countErr.message);
  else {
    const sourceCounts = {};
    counts?.forEach(w => {
      sourceCounts[w.source] = (sourceCounts[w.source] || 0) + 1;
    });
    console.log(JSON.stringify(sourceCounts, null, 2));
  }
}

check();
