import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = 'https://jklptmcosmwjqrwxmjbf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprbHB0bWNvc213anFyd3htamJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTY3MjIwMiwiZXhwIjoyMDY1MjQ4MjAyfQ.x72daTdBBUfv8xLj8gqLaifFeg0I_xHuZ_ECrVMFrPE';

async function runMigration() {
  // Read the SQL file
  const sqlPath = path.join(__dirname, 'taskpool-migration.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Split by statements (simple split, may need adjustment for complex SQL)
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Found ${statements.length} SQL statements to execute\n`);

  // Execute each statement via the REST API
  // For now, let's just create the tables directly using the Supabase client

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Test connection first
  console.log('Testing connection...');
  const { data: testData, error: testError } = await supabase.from('client_contacts').select('id').limit(1);

  if (testError) {
    console.error('Connection test failed:', testError.message);
    return;
  }
  console.log('Connection successful!\n');

  // Since we can't run arbitrary SQL, let's create tables via the Management API
  // or we need to run this SQL in the Supabase Dashboard SQL Editor

  console.log('SQL migration file created at:', sqlPath);
  console.log('\nPlease run this SQL in the Supabase Dashboard SQL Editor:');
  console.log('1. Go to https://supabase.com/dashboard/project/jklptmcosmwjqrwxmjbf/sql/new');
  console.log('2. Paste the contents of taskpool-migration.sql');
  console.log('3. Click "Run"\n');

  // Let's verify if any tables already exist
  console.log('Checking existing tables...');

  const tables = ['organizations', 'task_action_types', 'tasks', 'task_notes', 'task_activity_log', 'task_links', 'task_attachments'];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      if (error.code === '42P01') {
        console.log(`  ${table}: Does not exist (needs to be created)`);
      } else {
        console.log(`  ${table}: Error - ${error.message}`);
      }
    } else {
      console.log(`  ${table}: EXISTS (${data.length} rows returned)`);
    }
  }
}

runMigration().catch(console.error);
