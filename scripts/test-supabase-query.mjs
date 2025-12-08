import { createClient } from "@supabase/supabase-js";

// Use the service role key to bypass RLS for testing
const supabaseUrl = "https://cyygkhwujcrbhzgjqipj.supabase.co";
const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5eWdraHd1amNyYmh6Z2pxaXBqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc0MDk4NywiZXhwIjoyMDgwMzE2OTg3fQ.A307u4qstiXj_AWbLxaD1mhP9DUD_ImMWNYqKU1N7JI";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testQueries() {
  console.log("Testing Supabase queries...\n");

  // Test 1: Get action types
  console.log("1. Fetching action types...");
  const { data: actionTypes, error: atError } = await supabase
    .from("task_action_types")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (atError) {
    console.error("Action types error:", atError);
  } else {
    console.log(`Found ${actionTypes.length} action types:`);
    actionTypes.forEach((at) => console.log(`  - ${at.code}: ${at.label} (${at.id})`));
  }

  // Test 2: Get tasks with pool view filter
  console.log("\n2. Fetching tasks (pool view)...");
  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select(`
      *,
      action_type:task_action_types(id, code, label, color, icon)
    `)
    .is("claimed_by", null)
    .eq("status", "open")
    .order("created_at", { ascending: false });

  if (tasksError) {
    console.error("Tasks error:", tasksError);
  } else {
    console.log(`Found ${tasks.length} unclaimed open tasks:`);
    tasks.forEach((t) => {
      console.log(`  - ${t.title?.substring(0, 50)}`);
      console.log(`    action_type: ${t.action_type?.label || 'NULL'}, status: ${t.status}`);
    });
  }

  // Test 3: Get all tasks without filter
  console.log("\n3. Fetching ALL tasks (no filter)...");
  const { data: allTasks, error: allError } = await supabase
    .from("tasks")
    .select("id, title, status, claimed_by, action_type_id")
    .order("created_at", { ascending: false });

  if (allError) {
    console.error("All tasks error:", allError);
  } else {
    console.log(`Found ${allTasks.length} total tasks:`);
    allTasks.forEach((t) => console.log(`  - ${t.status} | claimed: ${t.claimed_by ? 'yes' : 'no'} | ${t.title?.substring(0, 40)}`));
  }
}

testQueries().catch(console.error);
