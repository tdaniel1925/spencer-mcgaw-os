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
  console.log('🔍 Comprehensive Table Check\n');
  console.log('=' .repeat(60));

  // User Management Tables
  console.log('\n👥 USER MANAGEMENT TABLES:');
  const userTables = ['users', 'user_profiles', 'organizations', 'user_permissions', 'user_privacy_settings'];

  for (const table of userTables) {
    await checkTable(table);
  }

  // Chat Tables
  console.log('\n💬 CHAT SYSTEM TABLES:');
  const chatTables = [
    'chat_rooms',
    'chat_messages',
    'chat_room_members',
    'chat_mentions',
    'chat_message_reactions',
    'chat_typing_indicators'
  ];

  for (const table of chatTables) {
    await checkTable(table);
  }

  // Supporting Tables
  console.log('\n🔔 SUPPORTING TABLES:');
  const supportTables = ['notifications', 'activity_logs'];

  for (const table of supportTables) {
    await checkTable(table);
  }

  console.log('\n' + '='.repeat(60));
}

async function checkTable(tableName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (error) {
      if (error.code === '42P01') {
        console.log(`  ❌ ${tableName.padEnd(30)} NOT FOUND`);
      } else {
        console.log(`  ⚠️  ${tableName.padEnd(30)} ERROR: ${error.message}`);
      }
    } else {
      const count = data?.length || 0;
      console.log(`  ✅ ${tableName.padEnd(30)} EXISTS`);
    }
  } catch (err) {
    console.log(`  ❌ ${tableName.padEnd(30)} ERROR: ${err.message}`);
  }
}

checkTables();
