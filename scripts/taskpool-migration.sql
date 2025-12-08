-- TaskPool Database Migration
-- Run this in Supabase SQL Editor

-- 1. Organizations table (for future multi-tenancy)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default organization
INSERT INTO organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Spencer McGaw', 'spencer-mcgaw')
ON CONFLICT (slug) DO NOTHING;

-- 2. Task Action Types table
CREATE TABLE IF NOT EXISTS task_action_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001',
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6B7280',
  icon TEXT DEFAULT 'clipboard',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, code)
);

-- 3. Tasks table
CREATE TABLE IF NOT EXISTS tasks (
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
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_action_type ON tasks(action_type_id);
CREATE INDEX IF NOT EXISTS idx_tasks_claimed_by ON tasks(claimed_by);
CREATE INDEX IF NOT EXISTS idx_tasks_client_id ON tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_organization ON tasks(organization_id);

-- 4. Task Notes table
CREATE TABLE IF NOT EXISTS task_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_notes_task_id ON task_notes(task_id);

-- 5. Task Activity Log table
CREATE TABLE IF NOT EXISTS task_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  performed_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_activity_task_id ON task_activity_log(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_action ON task_activity_log(action);

-- 6. Task Links table
CREATE TABLE IF NOT EXISTS task_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  target_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL DEFAULT 'related',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_task_id, target_task_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_task_links_source ON task_links(source_task_id);
CREATE INDEX IF NOT EXISTS idx_task_links_target ON task_links(target_task_id);

-- 7. Task Attachments table
CREATE TABLE IF NOT EXISTS task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);

-- Insert default action types
INSERT INTO task_action_types (code, label, description, color, icon, sort_order, organization_id)
VALUES
  ('RESPOND', 'Respond', 'Reply to client communication', '#3B82F6', 'message-square', 1, '00000000-0000-0000-0000-000000000001'),
  ('PREPARE', 'Prepare', 'Create documents, proposals, or deliverables', '#8B5CF6', 'file-text', 2, '00000000-0000-0000-0000-000000000001'),
  ('REVIEW', 'Review', 'Check and approve work', '#F59E0B', 'eye', 3, '00000000-0000-0000-0000-000000000001'),
  ('REQUEST', 'Request', 'Ask for information or materials', '#10B981', 'help-circle', 4, '00000000-0000-0000-0000-000000000001'),
  ('FILE', 'File', 'Submit documents to external parties', '#EF4444', 'send', 5, '00000000-0000-0000-0000-000000000001'),
  ('SCHEDULE', 'Schedule', 'Arrange meetings or deadlines', '#EC4899', 'calendar', 6, '00000000-0000-0000-0000-000000000001'),
  ('PROCESS', 'Process', 'Handle administrative tasks', '#6B7280', 'settings', 7, '00000000-0000-0000-0000-000000000001')
ON CONFLICT (organization_id, code) DO NOTHING;

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_action_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow authenticated users for now)
CREATE POLICY "Allow authenticated read organizations" ON organizations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read action_types" ON task_action_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated all tasks" ON tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated all task_notes" ON task_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated all task_activity_log" ON task_activity_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated all task_links" ON task_links FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated all task_attachments" ON task_attachments FOR ALL TO authenticated USING (true) WITH CHECK (true);
