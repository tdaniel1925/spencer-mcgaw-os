import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data, error } = await supabase
    .from('calls')
    .select('id, caller_name, caller_phone, direction, metadata')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.log('Error:', error);
    return;
  }

  data.forEach(call => {
    const meta = call.metadata || {};
    console.log('---');
    console.log('Name:', call.caller_name);
    console.log('Phone:', call.caller_phone);
    console.log('DB Direction:', call.direction);
    console.log('Caller in metadata:', meta.caller ? 'yes' : 'no');
    if (meta.caller) {
      console.log('  Caller originator:', meta.caller.originator);
      console.log('  Caller type:', meta.caller.type);
    }
    console.log('Participants:', (meta.participants || []).length);
    if (meta.participants) {
      meta.participants.forEach((p, i) => {
        console.log(`  [${i}] name: ${p.name}, type: ${p.type}, originator: ${p.originator}`);
      });
    }
  });
}

check();
