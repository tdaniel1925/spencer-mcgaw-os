/**
 * Fix call direction values based on caller.type information
 *
 * Logic:
 * - caller.type.value === 'LINE' or has lineId => outbound (internal user made the call)
 * - caller.type.value === 'PHONE_NUMBER' => inbound (external call came in)
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixCallDirections() {
  console.log('Fetching calls with caller metadata...');

  const { data: calls, error } = await supabase
    .from('calls')
    .select('id, caller_name, caller_phone, direction, metadata')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching calls:', error);
    return;
  }

  console.log(`Found ${calls.length} calls to check`);

  let fixedCount = 0;
  let skippedCount = 0;

  for (const call of calls) {
    const meta = call.metadata || {};
    const caller = meta.caller;

    if (!caller?.type) {
      skippedCount++;
      continue;
    }

    const callerType = caller.type?.value;
    const callerHasLineId = !!caller.type?.lineId;

    let correctDirection;
    if (callerType === 'LINE' || callerHasLineId) {
      correctDirection = 'outbound';
    } else if (callerType === 'PHONE_NUMBER') {
      correctDirection = 'inbound';
    } else {
      skippedCount++;
      continue;
    }

    if (call.direction !== correctDirection) {
      console.log(`Fixing ${call.caller_name || call.caller_phone}: ${call.direction} -> ${correctDirection}`);

      const { error: updateError } = await supabase
        .from('calls')
        .update({ direction: correctDirection })
        .eq('id', call.id);

      if (updateError) {
        console.error(`Failed to update ${call.id}:`, updateError);
      } else {
        fixedCount++;
      }
    }
  }

  console.log(`\nDone! Fixed ${fixedCount} calls, skipped ${skippedCount} (no caller type info)`);
}

fixCallDirections();
