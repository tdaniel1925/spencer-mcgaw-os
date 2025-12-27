-- =====================================================
-- TASKPOOL SYSTEM MIGRATION
-- Created: 2025-12-27
-- Description: Consolidates all taskpool-related tables
-- that were previously only in scripts/ folder
-- =====================================================

-- =====================================================
-- 1. ORGANIZATIONS TABLE
-- Multi-tenancy support (future)
-- =====================================================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default organization
INSERT INTO organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Spencer McGaw', 'spencer-mcgaw')
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- 2. TASK_ACTION_TYPES TABLE
-- Configurable task action categories
-- =====================================================
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, code)
);

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

-- =====================================================
-- 3. TASKS TABLE
-- Main task records
-- =====================================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) DEFAULT '00000000-0000-0000-0000-000000000001',

  -- Core fields
  title TEXT NOT NULL,
  description TEXT,
  action_type_id UUID REFERENCES task_action_types(id),

  -- Source tracking
  source_type TEXT DEFAULT 'manual' CHECK (source_type IN ('manual', 'email', 'calendar', 'recurring', 'ai')),
  source_email_id TEXT,
  source_metadata JSONB DEFAULT '{}',

  -- Assignment
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  claimed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,

  -- Status and priority
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting', 'completed', 'cancelled')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('urgent', 'high', 'medium', 'low')),

  -- Dates
  due_date DATE,
  due_time TIME,
  alert_threshold_hours INTEGER DEFAULT 24,
  completed_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,

  -- AI fields
  ai_confidence DECIMAL(3,2),
  ai_extracted_data JSONB DEFAULT '{}',

  -- Routing / Workflow
  next_action_type_id UUID REFERENCES task_action_types(id),
  routed_from_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,

  -- Progress
  estimated_minutes INTEGER,
  actual_minutes INTEGER,
  progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),

  -- Tags & Custom Fields
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_action_type ON tasks(action_type_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_claimed_by ON tasks(claimed_by);
CREATE INDEX IF NOT EXISTS idx_tasks_client_id ON tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_organization ON tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;

-- =====================================================
-- 4. TASK_NOTES TABLE
-- Comments and notes on tasks
-- =====================================================
CREATE TABLE IF NOT EXISTS task_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_notes_task_id ON task_notes(task_id);

-- =====================================================
-- 5. TASK_ACTIVITY_LOG TABLE
-- Audit trail for task changes
-- =====================================================
CREATE TABLE IF NOT EXISTS task_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  details JSONB DEFAULT '{}',
  performed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_activity_task_id ON task_activity_log(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_action ON task_activity_log(action);
CREATE INDEX IF NOT EXISTS idx_task_activity_created ON task_activity_log(created_at DESC);

-- =====================================================
-- 6. TASK_LINKS TABLE
-- Link related tasks together
-- =====================================================
CREATE TABLE IF NOT EXISTS task_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  target_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL DEFAULT 'related' CHECK (link_type IN ('related', 'blocks', 'blocked_by', 'duplicates', 'parent', 'child')),
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_task_id, target_task_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_task_links_source ON task_links(source_task_id);
CREATE INDEX IF NOT EXISTS idx_task_links_target ON task_links(target_task_id);

-- =====================================================
-- 7. TASK_ATTACHMENTS TABLE
-- Files attached to tasks
-- =====================================================
CREATE TABLE IF NOT EXISTS task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);

-- =====================================================
-- 8. TASK_STEPS TABLE
-- Checklist items within tasks
-- =====================================================
CREATE TABLE IF NOT EXISTS task_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_steps_task ON task_steps(task_id);
CREATE INDEX IF NOT EXISTS idx_task_steps_order ON task_steps(task_id, sort_order);

-- =====================================================
-- 9. TASK_HANDOFF_HISTORY TABLE
-- Track task handoffs between team members
-- =====================================================
CREATE TABLE IF NOT EXISTS task_handoff_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  from_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  to_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  reason TEXT,
  notes TEXT,
  handoff_type TEXT DEFAULT 'reassign' CHECK (handoff_type IN ('reassign', 'escalate', 'delegate', 'return')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_handoff_task ON task_handoff_history(task_id);

-- =====================================================
-- 10. AI_TRAINING_FEEDBACK TABLE
-- User feedback on AI suggestions for learning
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_training_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('task_classification', 'priority_suggestion', 'action_type', 'client_match', 'email_classification')),

  -- What was suggested
  entity_type TEXT NOT NULL,
  entity_id UUID,
  original_value TEXT,
  suggested_value TEXT,

  -- User's choice
  accepted BOOLEAN NOT NULL,
  user_value TEXT,
  user_reason TEXT,

  -- Metadata
  confidence_score DECIMAL(3,2),
  context JSONB DEFAULT '{}',

  -- User Info
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_type ON ai_training_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_entity ON ai_training_feedback(entity_type, entity_id);

-- =====================================================
-- 11. TASK_VISIBILITY_RULES TABLE
-- Control who can see which tasks
-- =====================================================
CREATE TABLE IF NOT EXISTS task_visibility_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What this rule applies to
  rule_type TEXT NOT NULL CHECK (rule_type IN ('user', 'role', 'department', 'client')),
  rule_value TEXT NOT NULL,

  -- Filter criteria
  action_type_id UUID REFERENCES task_action_types(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  priority TEXT,

  -- Permission
  can_view BOOLEAN NOT NULL DEFAULT true,
  can_claim BOOLEAN NOT NULL DEFAULT true,
  can_edit BOOLEAN NOT NULL DEFAULT false,

  -- Metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visibility_rules_type ON task_visibility_rules(rule_type, rule_value);

-- =====================================================
-- 12. TASK_POOLS TABLE
-- Named pools for grouping unclaimed tasks
-- =====================================================
CREATE TABLE IF NOT EXISTS task_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT NOT NULL UNIQUE,

  -- Settings
  auto_assign_enabled BOOLEAN NOT NULL DEFAULT false,
  round_robin_enabled BOOLEAN NOT NULL DEFAULT false,
  max_tasks_per_user INTEGER,

  -- Eligibility
  eligible_user_ids UUID[] DEFAULT '{}',
  eligible_roles TEXT[] DEFAULT '{}',
  eligible_departments UUID[] DEFAULT '{}',

  -- Filters
  action_type_ids UUID[] DEFAULT '{}',
  priority_filter TEXT[] DEFAULT '{}',

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Metadata
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_pools_slug ON task_pools(slug);
CREATE INDEX IF NOT EXISTS idx_task_pools_active ON task_pools(is_active) WHERE is_active = true;

-- =====================================================
-- 13. TASK_RECURRENCE TABLE
-- Recurring task definitions
-- =====================================================
CREATE TABLE IF NOT EXISTS task_recurrence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Template
  title TEXT NOT NULL,
  description TEXT,
  action_type_id UUID REFERENCES task_action_types(id),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  priority TEXT DEFAULT 'medium',
  estimated_minutes INTEGER,
  tags TEXT[] DEFAULT '{}',

  -- Recurrence Pattern
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  interval_value INTEGER NOT NULL DEFAULT 1,
  day_of_week INTEGER[], -- 0=Sunday, 6=Saturday
  day_of_month INTEGER[],
  month_of_year INTEGER[],

  -- Time Settings
  start_date DATE NOT NULL,
  end_date DATE,
  due_time TIME,
  lead_days INTEGER DEFAULT 0,

  -- Assignment
  assign_to UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  pool_id UUID REFERENCES task_pools(id) ON DELETE SET NULL,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_generated_at TIMESTAMPTZ,
  next_occurrence DATE,

  -- Metadata
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_recurrence_active ON task_recurrence(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_task_recurrence_next ON task_recurrence(next_occurrence);

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_action_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_handoff_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_training_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_visibility_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_recurrence ENABLE ROW LEVEL SECURITY;

-- Organizations
CREATE POLICY "View organizations" ON organizations
  FOR SELECT TO authenticated USING (true);

-- Task Action Types
CREATE POLICY "View action types" ON task_action_types
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage action types" ON task_action_types
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- Tasks
CREATE POLICY "View all tasks" ON tasks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Create tasks" ON tasks
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Update tasks" ON tasks
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Delete own tasks" ON tasks
  FOR DELETE USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- Task Notes
CREATE POLICY "View task notes" ON task_notes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Create task notes" ON task_notes
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Update own notes" ON task_notes
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Delete own notes" ON task_notes
  FOR DELETE USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- Task Activity Log
CREATE POLICY "View task activity" ON task_activity_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Insert task activity" ON task_activity_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- Task Links
CREATE POLICY "View task links" ON task_links
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Manage task links" ON task_links
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Task Attachments
CREATE POLICY "View task attachments" ON task_attachments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Manage task attachments" ON task_attachments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Task Steps
CREATE POLICY "View task steps" ON task_steps
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Manage task steps" ON task_steps
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Task Handoff History
CREATE POLICY "View handoff history" ON task_handoff_history
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Insert handoff history" ON task_handoff_history
  FOR INSERT TO authenticated WITH CHECK (true);

-- AI Training Feedback
CREATE POLICY "View AI feedback" ON ai_training_feedback
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Insert AI feedback" ON ai_training_feedback
  FOR INSERT TO authenticated WITH CHECK (true);

-- Task Visibility Rules
CREATE POLICY "View visibility rules" ON task_visibility_rules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage visibility rules" ON task_visibility_rules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- Task Pools
CREATE POLICY "View task pools" ON task_pools
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage task pools" ON task_pools
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- Task Recurrence
CREATE POLICY "View recurrence" ON task_recurrence
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Manage recurrence" ON task_recurrence
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- REALTIME SUBSCRIPTIONS
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'tasks') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
  END IF;
END $$;

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'organizations', 'tasks', 'task_notes', 'task_steps',
      'task_pools', 'task_recurrence'
    ])
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS update_%I_updated_at ON %I;
      CREATE TRIGGER update_%I_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    ', t, t, t, t);
  END LOOP;
END $$;

-- =====================================================
-- Add foreign key from project_tasks to tasks
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_tasks') THEN
    ALTER TABLE project_tasks DROP CONSTRAINT IF EXISTS project_tasks_task_id_fkey;
    ALTER TABLE project_tasks ADD CONSTRAINT project_tasks_task_id_fkey
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
  END IF;
END $$;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- This migration consolidates all taskpool tables from
-- scripts/ into proper migrations:
--
-- - organizations (1 default record)
-- - task_action_types (7 default records)
-- - tasks (main task table)
-- - task_notes
-- - task_activity_log
-- - task_links
-- - task_attachments
-- - task_steps (checklist items)
-- - task_handoff_history
-- - ai_training_feedback
-- - task_visibility_rules
-- - task_pools
-- - task_recurrence
--
-- Total: 13 tables with full RLS policies
-- =====================================================
