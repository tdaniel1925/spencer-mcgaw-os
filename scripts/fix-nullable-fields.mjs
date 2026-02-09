import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const client = postgres(connectionString);

try {
  console.log('\n🔧 Making email_messages fields nullable...\n');

  // Make user_id nullable
  await client`
    ALTER TABLE "email_messages"
    ALTER COLUMN "user_id" DROP NOT NULL;
  `;
  console.log('  ✅ user_id is now nullable');

  // Make connection_id nullable
  await client`
    ALTER TABLE "email_messages"
    ALTER COLUMN "connection_id" DROP NOT NULL;
  `;
  console.log('  ✅ connection_id is now nullable');

  // Make potential_tasks.user_id nullable
  await client`
    ALTER TABLE "potential_tasks"
    ALTER COLUMN "user_id" DROP NOT NULL;
  `;
  console.log('  ✅ potential_tasks.user_id is now nullable');

  console.log('\n✅ All fields updated successfully!\n');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
} finally {
  await client.end();
}
