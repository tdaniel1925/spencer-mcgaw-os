-- TaskPool Fix - Drop and recreate tasks table
-- Run this in Supabase SQL Editor if you're getting "column action_type_id does not exist" error

-- First, drop dependent tables (if they exist)
DROP TABLE IF EXISTS task_attachments CASCADE;
DROP TABLE IF EXISTS task_links CASCADE;
DROP TABLE IF EXISTS task_activity_log CASCADE;
DROP TABLE IF EXISTS task_notes CASCADE;

-- Drop the tasks table to recreate it properly
DROP TABLE IF EXISTS tasks CASCADE;

-- Now recreate tasks table with all columns
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001',

  -- Core fields
  title TEXT NOT NULL,
  description TEXT,
  action_type_id UUID REFERENCES task_action_types(id),

  -- Source tracking
  source_type TEXT DEFAULT 'manual',
  source_email_id UUID,
  source_metadata JSONB DEFAULT '{}',

  -- Assignment
  client_id UUID REFERENCES client_contacts(id),
  assigned_to UUID,
  claimed_by UUID,
  claimed_at TIMESTAMPTZ,

  -- Status and priority
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'medium',

  -- Dates
  due_date DATE,
  completed_at TIMESTAMPTZ,

  -- AI fields
  ai_confidence DECIMAL(3,2),
  ai_extracted_data JSONB DEFAULT '{}',

  -- Routing
  next_action_type_id UUID REFERENCES task_action_types(id),
  routed_from_task_id UUID REFERENCES tasks(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- Indexes for common queries
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_action_type ON tasks(action_type_id);
CREATE INDEX idx_tasks_claimed_by ON tasks(claimed_by);
CREATE INDEX idx_tasks_client_id ON tasks(client_id);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_organization ON tasks(organization_id);

-- Recreate dependent tables

-- Task Notes table
CREATE TABLE task_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_task_notes_task_id ON task_notes(task_id);

-- Task Activity Log table
CREATE TABLE task_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  performed_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_task_activity_task_id ON task_activity_log(task_id);
CREATE INDEX idx_task_activity_action ON task_activity_log(action);

-- Task Links table
CREATE TABLE task_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  target_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL DEFAULT 'related',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_task_id, target_task_id, link_type)
);

CREATE INDEX idx_task_links_source ON task_links(source_task_id);
CREATE INDEX idx_task_links_target ON task_links(target_task_id);

-- Task Attachments table
CREATE TABLE task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_task_attachments_task_id ON task_attachments(task_id);

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Allow authenticated all tasks" ON tasks;
DROP POLICY IF EXISTS "Allow authenticated all task_notes" ON task_notes;
DROP POLICY IF EXISTS "Allow authenticated all task_activity_log" ON task_activity_log;
DROP POLICY IF EXISTS "Allow authenticated all task_links" ON task_links;
DROP POLICY IF EXISTS "Allow authenticated all task_attachments" ON task_attachments;

CREATE POLICY "Allow authenticated all tasks" ON tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated all task_notes" ON task_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated all task_activity_log" ON task_activity_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated all task_links" ON task_links FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated all task_attachments" ON task_attachments FOR ALL TO authenticated USING (true) WITH CHECK (true);
