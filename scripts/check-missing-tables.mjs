import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config({ path: '.env.local' });
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkMissingTables() {
  const client = await pool.connect();

  try {
    // Tables that are referenced in the code
    const referencedTables = [
      'email_sender_rules',
      'email_training_feedback',
      'email_classifications',
      'email_action_items',
      'user_profiles',
    ];

    console.log('🔍 Checking for missing tables...\n');
    console.log('─'.repeat(70));

    const missing = [];
    const existing = [];

    for (const tableName of referencedTables) {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = $1
        );
      `, [tableName]);

      if (result.rows[0].exists) {
        existing.push(tableName);
        console.log(`✅ ${tableName.padEnd(30)} EXISTS`);
      } else {
        missing.push(tableName);
        console.log(`❌ ${tableName.padEnd(30)} MISSING`);
      }
    }

    console.log('─'.repeat(70));
    console.log(`\n📊 Summary: ${existing.length} existing, ${missing.length} missing\n`);

    if (missing.length > 0) {
      console.log('⚠️  BREAKING ISSUES FOUND:\n');
      console.log('The following tables are referenced in API routes but do not exist:');
      missing.forEach(table => console.log(`  • ${table}`));
      console.log('\n💡 Run the email training migration to create these tables.');
    }

    // Check email_connections for missing columns
    console.log('\n🔍 Checking email_connections columns...\n');
    console.log('─'.repeat(70));

    const expectedColumns = ['is_global', 'description', 'display_order'];

    for (const colName of expectedColumns) {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_name = 'email_connections' AND column_name = $1
        );
      `, [colName]);

      if (result.rows[0].exists) {
        console.log(`✅ email_connections.${colName.padEnd(20)} EXISTS`);
      } else {
        console.log(`❌ email_connections.${colName.padEnd(20)} MISSING`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkMissingTables();
