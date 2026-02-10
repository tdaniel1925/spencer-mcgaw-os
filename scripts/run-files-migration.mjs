import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import postgres from 'postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const client = postgres(connectionString);

async function runMigration() {
  try {
    console.log('\n🚀 Running Files System Migration...\n');

    // Read migration file
    const migrationPath = join(__dirname, '..', 'drizzle', '0004_files_system_complete.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    // Execute migration
    await client.unsafe(sql);

    console.log('✅ Migration completed successfully!\n');

    // Verify tables were created
    const tables = await client`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('folders', 'files', 'file_shares', 'file_versions', 'folder_permissions', 'storage_quotas', 'file_activity')
      ORDER BY table_name;
    `;

    console.log('📋 Created tables:');
    tables.forEach(t => console.log(`   ✅ ${t.table_name}`));

    // Verify RPC functions were created
    const functions = await client`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_name IN ('check_and_reserve_quota', 'release_quota', 'recalculate_quota', 'cleanup_expired_shares')
      ORDER BY routine_name;
    `;

    console.log('\n🔧 Created functions:');
    functions.forEach(f => console.log(`   ✅ ${f.routine_name}()`));

    // Check if Supabase storage bucket exists
    console.log('\n📦 Next Steps:');
    console.log('   1. Create Supabase storage bucket named "files"');
    console.log('   2. Set bucket to private (authenticated users only)');
    console.log('   3. Set max file size to 100MB');
    console.log('   4. Test file upload via UI');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
