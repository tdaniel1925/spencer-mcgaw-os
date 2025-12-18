/**
 * Backfill tasks from existing calls that have AI suggested actions
 * but no tasks were created (due to webhook issues)
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEFAULT_ORGANIZATION_ID = "00000000-0000-0000-0000-000000000001";

async function backfillTasks() {
  console.log('Fetching calls with AI analysis...\n');

  // Get all calls with metadata containing analysis.suggestedActions
  const { data: calls, error } = await supabase
    .from('calls')
    .select('id, caller_name, caller_phone, client_id, summary, metadata')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching calls:', error);
    return;
  }

  console.log('Found ' + calls.length + ' total calls');

  let totalTasksCreated = 0;
  let callsProcessed = 0;

  for (const call of calls) {
    const meta = call.metadata || {};
    const analysis = meta.analysis || {};
    const suggestedActions = analysis.suggestedActions || [];

    if (suggestedActions.length === 0) continue;

    callsProcessed++;

    // Check existing tasks for this call
    const { data: existingTasks } = await supabase
      .from('tasks')
      .select('id, title')
      .eq('source_call_id', call.id);

    const existingTaskTitles = new Set((existingTasks || []).map(t => t.title));

    console.log('\n--- Call: ' + (call.caller_name || call.caller_phone) + ' ---');
    console.log('  Suggested actions: ' + suggestedActions.length);
    console.log('  Existing tasks: ' + (existingTasks?.length || 0));

    for (const action of suggestedActions) {
      if (existingTaskTitles.has(action)) {
        console.log('  [SKIP] ' + action.substring(0, 50));
        continue;
      }

      const callerInfo = call.caller_name || call.caller_phone || 'unknown caller';
      const { data: newTask, error: taskError } = await supabase
        .from('tasks')
        .insert({
          title: action,
          description: 'AI-suggested task from call with ' + callerInfo + '.\n\nCall Summary: ' + (call.summary || 'Not available'),
          status: 'pending',
          priority: analysis.urgency === 'urgent' ? 'urgent' :
                   analysis.urgency === 'high' ? 'high' : 'medium',
          source_type: 'phone_call',
          source_call_id: call.id,
          client_id: call.client_id,
          source_metadata: {
            caller_phone: call.caller_phone,
            caller_name: call.caller_name,
            backfilled: true,
          },
          ai_confidence: meta.confidence || 0.8,
          ai_extracted_data: {
            ai_suggested: true,
            source_type: 'call_analysis',
            urgency: analysis.urgency,
            category: analysis.category,
            call_summary: call.summary,
          },
          organization_id: DEFAULT_ORGANIZATION_ID,
        })
        .select('id')
        .single();

      if (taskError) {
        console.log('  [ERROR] ' + action.substring(0, 40) + ': ' + taskError.message);
      } else {
        console.log('  [CREATED] ' + action.substring(0, 50));
        totalTasksCreated++;
      }
    }
  }

  console.log('\n========================================');
  console.log('Calls with suggested actions: ' + callsProcessed);
  console.log('Total tasks created: ' + totalTasksCreated);
  console.log('========================================');
}

backfillTasks();
