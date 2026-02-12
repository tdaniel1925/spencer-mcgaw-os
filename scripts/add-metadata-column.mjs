import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addMetadataColumn() {
  try {
    console.log('🔄 Adding metadata column to email_connections...');

    const { error } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE email_connections ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;`
    });

    if (error) {
      // Try direct approach
      const { error: error2 } = await supabase
        .from('email_connections')
        .select('metadata')
        .limit(1);

      if (error2 && error2.message.includes('column "metadata" does not exist')) {
        console.error('❌ Column does not exist and cannot be added via Supabase client');
        console.log('\n📝 Please run this SQL manually in your Supabase SQL editor:');
        console.log('\nALTER TABLE email_connections ADD COLUMN metadata JSONB DEFAULT \'{}\' ::jsonb;\n');
        process.exit(1);
      } else if (!error2) {
        console.log('✅ Column already exists!');
      } else {
        console.error('❌ Error checking column:', error2);
        process.exit(1);
      }
    } else {
      console.log('✅ Column added successfully!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addMetadataColumn();
