import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkConnections() {
  console.log('🔍 Checking email connections...\n');

  // Check connections
  const { data: connections, error: connError } = await supabase
    .from('email_connections')
    .select('id, user_id, email, provider, is_active, metadata, created_at')
    .eq('provider', 'imap');

  if (connError) {
    console.error('❌ Error fetching connections:', connError);
    return;
  }

  console.log(`📧 Found ${connections?.length || 0} IMAP connections:\n`);

  if (connections && connections.length > 0) {
    connections.forEach((conn, idx) => {
      console.log(`${idx + 1}. ${conn.email}`);
      console.log(`   User ID: ${conn.user_id}`);
      console.log(`   Active: ${conn.is_active}`);
      console.log(`   Provider: ${conn.provider}`);
      console.log(`   Metadata:`, conn.metadata);
      console.log('');
    });
  } else {
    console.log('⚠️  No IMAP connections found!\n');
    console.log('👉 Go to Settings → Email tab and connect your Fastmail account\n');
  }

  // Check emails
  const { data: emails, error: emailError } = await supabase
    .from('email_messages')
    .select('id, subject, from_email, received_at, user_id')
    .order('received_at', { ascending: false })
    .limit(10);

  if (emailError) {
    console.error('❌ Error fetching emails:', emailError);
    return;
  }

  console.log(`📬 Found ${emails?.length || 0} emails in database\n`);

  if (emails && emails.length > 0) {
    emails.forEach((email, idx) => {
      console.log(`${idx + 1}. ${email.subject}`);
      console.log(`   From: ${email.from_email}`);
      console.log(`   Date: ${email.received_at}`);
      console.log('');
    });
  }
}

checkConnections().then(() => process.exit(0));
