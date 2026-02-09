#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('🔄 Reading migration file...');

  const migrationPath = join(__dirname, '../drizzle/0000_freezing_mantis.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf-8');

  console.log('📊 Migration file loaded');
  console.log(`📏 Size: ${(migrationSQL.length / 1024).toFixed(2)} KB`);

  // Split by statement-breakpoint or semicolons
  const statements = migrationSQL
    .split('--> statement-breakpoint')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .flatMap(block => {
      // Further split by semicolons for statements without breakpoints
      return block.split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    });

  console.log(`📝 Found ${statements.length} SQL statements`);
  console.log('\n🚀 Starting migration...\n');

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    const preview = statement.substring(0, 80).replace(/\n/g, ' ');

    try {
      console.log(`[${i + 1}/${statements.length}] ${preview}...`);

      const { error } = await supabase.rpc('exec_sql', {
        sql: statement
      });

      if (error) {
        // Some errors are expected (e.g., "already exists")
        if (error.message.includes('already exists')) {
          console.log(`   ⚠️  Already exists (skipping)`);
          successCount++;
        } else {
          console.error(`   ❌ Error: ${error.message}`);
          errorCount++;
        }
      } else {
        console.log(`   ✅ Success`);
        successCount++;
      }
    } catch (e) {
      console.error(`   ❌ Exception: ${e.message}`);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log('='.repeat(60));

  if (errorCount === 0) {
    console.log('\n🎉 Migration completed successfully!');
  } else {
    console.log('\n⚠️  Migration completed with some errors.');
    console.log('   Check the output above for details.');
  }
}

applyMigration().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
