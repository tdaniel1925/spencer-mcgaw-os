-- TaskPool Database Migration - STEP 4
-- Run this LAST in Supabase SQL Editor (after step 3 completes)

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_action_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow authenticated users for now)
-- Drop existing policies if they exist (ignore errors)
DROP POLICY IF EXISTS "Allow authenticated read organizations" ON organizations;
DROP POLICY IF EXISTS "Allow authenticated read action_types" ON task_action_types;
DROP POLICY IF EXISTS "Allow authenticated all tasks" ON tasks;
DROP POLICY IF EXISTS "Allow authenticated all task_notes" ON task_notes;
DROP POLICY IF EXISTS "Allow authenticated all task_activity_log" ON task_activity_log;
DROP POLICY IF EXISTS "Allow authenticated all task_links" ON task_links;
DROP POLICY IF EXISTS "Allow authenticated all task_attachments" ON task_attachments;

-- Create RLS policies
CREATE POLICY "Allow authenticated read organizations" ON organizations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read action_types" ON task_action_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated all tasks" ON tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated all task_notes" ON task_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated all task_activity_log" ON task_activity_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated all task_links" ON task_links FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated all task_attachments" ON task_attachments FOR ALL TO authenticated USING (true) WITH CHECK (true);
