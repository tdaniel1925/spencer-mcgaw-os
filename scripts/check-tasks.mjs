import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Check for email-sourced tasks
  const { data: emailTasks } = await supabase
    .from('tasks')
    .select('id, title, source_type, source_email_id, created_at')
    .eq('source_type', 'email')
    .order('created_at', { ascending: false })
    .limit(10);
  console.log('Email tasks:', emailTasks?.length || 0);
  if (emailTasks) {
    emailTasks.forEach(t => console.log(' -', t.title?.substring(0, 50), t.created_at));
  }

  // Check for phone-sourced tasks
  const { data: phoneTasks } = await supabase
    .from('tasks')
    .select('id, title, source_type, source_call_id, created_at')
    .eq('source_type', 'phone_call')
    .order('created_at', { ascending: false })
    .limit(10);
  console.log('\nPhone call tasks:', phoneTasks?.length || 0);
  if (phoneTasks) {
    phoneTasks.forEach(t => console.log(' -', t.title?.substring(0, 50), t.created_at));
  }

  // Check email_action_items
  const { data: actionItems } = await supabase
    .from('email_action_items')
    .select('id, title, email_message_id, created_task_id, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  console.log('\nEmail action items:', actionItems?.length || 0);
  if (actionItems) {
    actionItems.forEach(a => console.log(' -', a.title?.substring(0, 50), '| task:', a.created_task_id || 'NONE'));
  }

  // Check all source types in tasks
  const { data: allTasks } = await supabase.from('tasks').select('source_type, source');
  const counts = {};
  (allTasks || []).forEach(t => {
    const key = t.source_type || t.source || 'null';
    counts[key] = (counts[key] || 0) + 1;
  });
  console.log('\nTask source type counts:', JSON.stringify(counts, null, 2));

  // Total tasks
  console.log('\nTotal tasks:', allTasks?.length || 0);
}

check();
