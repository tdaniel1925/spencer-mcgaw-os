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

async function checkFilesTables() {
  const tables = ['folders', 'files', 'file_versions', 'file_shares', 'folder_permissions', 'storage_quotas', 'file_activity'];

  console.log('🔍 Checking files system tables...\n');

  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('id')
        .limit(1);

      if (error) {
        if (error.code === '42P01') {
          console.log(`❌ ${table}: NOT FOUND`);
        } else {
          console.log(`⚠️  ${table}: Error - ${error.message}`);
        }
      } else {
        const count = data?.length || 0;
        console.log(`✅ ${table}: EXISTS (${count} row${count === 1 ? '' : 's'} found)`);
      }
    } catch (err) {
      console.error(`❌ ${table}: ${err.message}`);
    }
  }

  // Check RPC functions
  console.log('\n🔧 Checking RPC functions...\n');

  const functions = ['check_and_reserve_quota', 'release_quota', 'recalculate_quota', 'cleanup_expired_shares'];

  for (const func of functions) {
    try {
      // Try to call with dummy params to see if function exists
      const { error } = await supabase.rpc(func, func === 'cleanup_expired_shares' ? {} : {
        p_user_id: '00000000-0000-0000-0000-000000000000',
        p_bytes: 0
      });

      if (error && error.message.includes('does not exist')) {
        console.log(`❌ ${func}(): NOT FOUND`);
      } else {
        console.log(`✅ ${func}(): EXISTS`);
      }
    } catch (err) {
      console.log(`✅ ${func}(): EXISTS (caught expected error)`);
    }
  }
}

checkFilesTables();
