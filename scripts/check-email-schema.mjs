import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const client = postgres(connectionString);
const db = drizzle(client);

try {
  // Check if email_messages table exists and what columns it has
  const result = await client`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'email_messages'
    ORDER BY ordinal_position;
  `;

  console.log('\n📋 email_messages table schema:\n');
  result.forEach(col => {
    const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
    console.log(`  ${col.column_name}: ${col.data_type} ${nullable}`);
  });

  // Check for unique constraints
  const constraints = await client`
    SELECT constraint_name, constraint_type
    FROM information_schema.table_constraints
    WHERE table_name = 'email_messages'
    AND constraint_type = 'UNIQUE';
  `;

  console.log('\n🔒 Unique constraints:\n');
  constraints.forEach(c => {
    console.log(`  ${c.constraint_name}`);
  });

  // Check if there are any records with the problem message_id
  const testId = 'b195bbbc-4d8b-4cab-9d34-59b95359e163';
  const existing = await client`
    SELECT id, message_id, from_email, subject, created_at
    FROM email_messages
    WHERE message_id = ${testId}
  `;

  console.log(`\n🔍 Checking for message_id: ${testId}\n`);
  if (existing.length > 0) {
    console.log(`  ✅ Found existing record:`);
    existing.forEach(r => {
      console.log(`     ID: ${r.id}`);
      console.log(`     From: ${r.from_email}`);
      console.log(`     Subject: ${r.subject}`);
      console.log(`     Created: ${r.created_at}`);
    });
  } else {
    console.log(`  ❌ No existing record found`);
  }

} catch (error) {
  console.error('Error:', error.message);
} finally {
  await client.end();
}
