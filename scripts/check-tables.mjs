#!/usr/bin/env node
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../.env.local'), quiet: true });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTables() {
  console.log('🔍 Checking if email_connections table exists...\n');

  try {
    const { data, error } = await supabase
      .from('email_connections')
      .select('id')
      .limit(1);

    if (error) {
      if (error.code === '42P01') {
        console.log('❌ Table does NOT exist');
        console.log('\n📋 You need to run this migration in Supabase SQL Editor:');
        console.log('   https://supabase.com/dashboard/project/cyygkhwujcrbhzgjqipj/sql\n');
        console.log('   File: supabase/migrations/20251227_foundation_tables.sql');
      } else {
        console.log('⚠️  Error checking table:', error.message);
      }
    } else {
      console.log('✅ Table EXISTS!');
      console.log(`   Found ${data?.length || 0} connection(s)`);

      // Check for current user's connection
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        const { data: userConn } = await supabase
          .from('email_connections')
          .select('*')
          .eq('user_id', authData.user.id);

        console.log(`\n   Your connections: ${userConn?.length || 0}`);
      }
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

checkTables();
