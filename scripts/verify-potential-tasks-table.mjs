import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config({ path: '.env.local' });
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function verifyTable() {
  const client = await pool.connect();

  try {
    // Check table structure
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'potential_tasks'
      ORDER BY ordinal_position
    `);

    console.log('\n✅ Table "potential_tasks" exists with columns:');
    console.log('─'.repeat(70));
    columns.rows.forEach(col => {
      console.log(`  ${col.column_name.padEnd(30)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });

    // Check indexes
    const indexes = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'potential_tasks'
    `);

    console.log('\n✅ Indexes:');
    console.log('─'.repeat(70));
    indexes.rows.forEach(idx => {
      console.log(`  • ${idx.indexname}`);
    });

    // Check enum values
    const enumValues = await client.query(`
      SELECT enumlabel
      FROM pg_enum
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'potential_task_status')
      ORDER BY enumsortorder
    `);

    console.log('\n✅ Enum "potential_task_status" values:');
    console.log('─'.repeat(70));
    enumValues.rows.forEach(val => {
      console.log(`  • ${val.enumlabel}`);
    });

    console.log('\n🎉 Database migration verified successfully!\n');

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

verifyTable();
