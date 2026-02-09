import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const client = postgres(connectionString);

try {
  console.log('\n🔧 Adding first_viewed tracking columns...\n');

  // Add to email_messages
  await client`
    ALTER TABLE "email_messages"
    ADD COLUMN IF NOT EXISTS "first_viewed_at" timestamp,
    ADD COLUMN IF NOT EXISTS "first_viewed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL;
  `;
  console.log('  ✅ email_messages first_viewed columns added');

  // Add to calls
  await client`
    ALTER TABLE "calls"
    ADD COLUMN IF NOT EXISTS "first_viewed_at" timestamp,
    ADD COLUMN IF NOT EXISTS "first_viewed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL;
  `;
  console.log('  ✅ calls first_viewed columns added');

  console.log('\n✅ All tracking columns added successfully!\n');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
} finally {
  await client.end();
}
