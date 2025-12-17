import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://cyygkhwujcrbhzgjqipj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5eWdraHd1amNyYmh6Z2pxaXBqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc0MDk4NywiZXhwIjoyMDgwMzE2OTg3fQ.A307u4qstiXj_AWbLxaD1mhP9DUD_ImMWNYqKU1N7JI'
);

async function main() {
  console.log('=== Debugging Tasks ===\n');

  // Check if tasks table exists and has the right columns
  console.log('1. Checking tasks table structure...\n');

  const { data: tasks, error: taskError } = await supabase
    .from('tasks')
    .select('*')
    .limit(5);

  if (taskError) {
    console.error('Error querying tasks:', taskError);
  } else {
    console.log('Tasks count:', tasks?.length || 0);
    if (tasks?.length > 0) {
      console.log('Sample task columns:', Object.keys(tasks[0]));
      console.log('Sample task:', JSON.stringify(tasks[0], null, 2));
    } else {
      console.log('No tasks in database yet');
    }
  }

  // Check calls with suggested actions
  console.log('\n2. Checking recent calls with AI suggested actions...\n');

  const { data: calls, error: callError } = await supabase
    .from('calls')
    .select('id, metadata, created_at')
    .not('metadata', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);

  if (callError) {
    console.error('Error querying calls:', callError);
  } else {
    let totalActions = 0;
    calls?.forEach(call => {
      const actions = call.metadata?.analysis?.suggestedActions || [];
      if (actions.length > 0) {
        console.log(`Call ${call.id}:`);
        console.log(`  Created: ${call.created_at}`);
        console.log(`  Suggested Actions: ${actions.length}`);
        actions.forEach((a, i) => console.log(`    ${i+1}. ${a}`));
        totalActions += actions.length;
      }
    });
    console.log(`\nTotal suggested actions in recent calls: ${totalActions}`);
  }

  // Try to insert a test task to check if the schema is correct
  console.log('\n3. Testing task insertion...\n');

  const testTask = {
    title: 'Test AI Task',
    description: 'Testing if task creation works',
    status: 'pending',
    priority: 'medium',
    source: 'phone_call',
    metadata: {
      aiSuggested: true,
      testTask: true
    }
  };

  const { data: insertedTask, error: insertError } = await supabase
    .from('tasks')
    .insert(testTask)
    .select()
    .single();

  if (insertError) {
    console.error('Failed to insert test task:', insertError);
    console.log('\nThe error above tells us what\'s wrong with the schema.');
    console.log('If it says "source" column doesn\'t exist, run this SQL in Supabase:');
    console.log(`
DO $$ BEGIN
  CREATE TYPE task_source AS ENUM ('phone_call', 'email', 'manual', 'document_intake');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source task_source NOT NULL DEFAULT 'manual';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_reference_id UUID;
    `);
  } else {
    console.log('Test task inserted successfully!');
    console.log('Task ID:', insertedTask.id);

    // Clean up test task
    await supabase.from('tasks').delete().eq('id', insertedTask.id);
    console.log('Test task cleaned up.');
    console.log('\nTask creation is working! New calls should create tasks automatically.');
  }
}

main().catch(console.error);
