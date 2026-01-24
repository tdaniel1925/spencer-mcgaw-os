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

async function debugConnection() {
  console.log('🔍 Checking email connections...\n');

  try {
    // Try to select all columns - will show us what exists
    const { data: connections, error } = await supabase
      .from('email_connections')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.log('❌ Error:', error.message);
      return;
    }

    console.log(`Found ${connections.length} connection(s):\n`);

    connections.forEach((conn, i) => {
      console.log(`Connection ${i + 1}:`);
      console.log(`  ID: ${conn.id}`);
      console.log(`  User: ${conn.user_id}`);
      console.log(`  Provider: ${conn.provider}`);
      console.log(`  Email: ${conn.email}`);
      console.log(`  Active: ${conn.is_active}`);
      console.log(`  Has Access Token: ${conn.access_token ? 'Yes' : 'No'}`);
      console.log(`  Has Refresh Token: ${conn.refresh_token ? 'Yes' : 'No'}`);
      console.log(`  Expires: ${conn.expires_at}`);

      // Check if expired
      if (conn.expires_at) {
        const expired = new Date(conn.expires_at) <= new Date();
        console.log(`  Status: ${expired ? '⚠️  EXPIRED' : '✅ Valid'}`);
      }

      console.log(`  Created: ${conn.created_at}\n`);
    });

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

debugConnection();
