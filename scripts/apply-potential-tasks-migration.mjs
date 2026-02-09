import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;

// Load .env.local first, then .env
dotenv.config({ path: '.env.local' });
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function applyMigration() {
  const client = await pool.connect();

  try {
    console.log('🔄 Checking if potential_task_status enum exists...');

    // Check if enum exists
    const enumCheck = await client.query(`
      SELECT 1 FROM pg_type WHERE typname = 'potential_task_status'
    `);

    if (enumCheck.rows.length === 0) {
      console.log('📝 Creating potential_task_status enum...');
      await client.query(`
        CREATE TYPE potential_task_status AS ENUM ('pending', 'approved', 'dismissed', 'expired');
      `);
      console.log('✅ Enum created');
    } else {
      console.log('⏭️  Enum already exists');
    }

    console.log('🔄 Checking if potential_tasks table exists...');

    // Check if table exists
    const tableCheck = await client.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'potential_tasks'
    `);

    if (tableCheck.rows.length === 0) {
      console.log('📝 Creating potential_tasks table...');
      await client.query(`
        CREATE TABLE potential_tasks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

          source_email_from VARCHAR(255) NOT NULL,
          source_email_subject TEXT,
          source_email_body TEXT,
          source_email_received_at TIMESTAMP NOT NULL,
          email_message_id UUID REFERENCES email_messages(id) ON DELETE SET NULL,

          suggested_title TEXT NOT NULL,
          suggested_description TEXT,
          suggested_action_type_id UUID REFERENCES task_action_types(id),
          suggested_client_id UUID REFERENCES clients(id),
          suggested_assigned_to UUID REFERENCES users(id),
          suggested_due_date TIMESTAMP,
          suggested_priority TEXT DEFAULT 'medium',

          ai_confidence INTEGER NOT NULL,
          ai_reasoning TEXT,
          ai_extracted_data JSONB DEFAULT '{}',

          status potential_task_status NOT NULL DEFAULT 'pending',
          reviewed_at TIMESTAMP,
          reviewed_by UUID REFERENCES users(id),
          dismissal_reason TEXT,

          created_task_id UUID REFERENCES tasks(id),
          expires_at TIMESTAMP NOT NULL,

          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);
      console.log('✅ Table created');

      console.log('📝 Creating indexes...');
      await client.query(`
        CREATE INDEX idx_potential_tasks_user_id ON potential_tasks(user_id);
        CREATE INDEX idx_potential_tasks_status ON potential_tasks(status);
        CREATE INDEX idx_potential_tasks_expires_at ON potential_tasks(expires_at);
        CREATE INDEX idx_potential_tasks_created_at ON potential_tasks(created_at);
      `);
      console.log('✅ Indexes created');
    } else {
      console.log('⏭️  Table already exists');
    }

    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration();
