-- Task Pool Enhancements Migration
-- Run this in Supabase Dashboard SQL Editor

-- ============================================
-- 1. PROJECT/SUB-TASK HIERARCHY
-- ============================================

-- Add parent_task_id for sub-task relationships
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE;

-- Add is_project flag to distinguish projects from tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_project BOOLEAN DEFAULT FALSE;

-- Add ordering for sub-tasks within a project
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_order INTEGER;

-- Index for fast sub-task queries
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);

-- ============================================
-- 2. TASK STEPS (CHECKLIST ITEMS)
-- ============================================

CREATE TABLE IF NOT EXISTS task_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  assigned_to UUID REFERENCES users(id),
  is_completed BOOLEAN DEFAULT FALSE,
  completed_by UUID REFERENCES users(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast step queries
CREATE INDEX IF NOT EXISTS idx_task_steps_task_id ON task_steps(task_id);

-- ============================================
-- 3. TASK HANDOFFS
-- ============================================

-- Add handoff fields to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS handoff_to UUID REFERENCES users(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS handoff_from UUID REFERENCES users(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS handoff_notes TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS handoff_at TIMESTAMPTZ;

-- Track handoff chain (who has worked on this task)
CREATE TABLE IF NOT EXISTS task_handoff_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  from_user_id UUID REFERENCES users(id),
  to_user_id UUID NOT NULL REFERENCES users(id),
  notes TEXT,
  handed_off_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_handoff_history_task_id ON task_handoff_history(task_id);

-- ============================================
-- 4. AI TRAINING FEEDBACK
-- ============================================

-- Add ai_corrected flag to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS ai_corrected BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS ai_training_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  original_action_type_id UUID REFERENCES task_action_types(id),
  corrected_action_type_id UUID REFERENCES task_action_types(id),
  original_priority VARCHAR(20),
  corrected_priority VARCHAR(20),
  feedback_text TEXT,
  was_correct BOOLEAN DEFAULT FALSE, -- TRUE if AI classification was confirmed correct
  feedback_type VARCHAR(50) DEFAULT 'correction', -- 'correction', 'approval', 'suggestion'
  submitted_by UUID REFERENCES users(id),
  is_processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if table already existed without them
ALTER TABLE ai_training_feedback ADD COLUMN IF NOT EXISTS was_correct BOOLEAN DEFAULT FALSE;
ALTER TABLE ai_training_feedback ADD COLUMN IF NOT EXISTS is_processed BOOLEAN DEFAULT FALSE;
ALTER TABLE ai_training_feedback ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
ALTER TABLE ai_training_feedback ADD COLUMN IF NOT EXISTS feedback_type VARCHAR(50) DEFAULT 'correction';

CREATE INDEX IF NOT EXISTS idx_ai_training_feedback_task_id ON ai_training_feedback(task_id);
CREATE INDEX IF NOT EXISTS idx_ai_training_feedback_unprocessed ON ai_training_feedback(is_processed) WHERE is_processed = FALSE;

-- ============================================
-- 5. TASK VISIBILITY/PERMISSIONS
-- ============================================

CREATE TABLE IF NOT EXISTS task_visibility_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  role VARCHAR(50), -- 'admin', 'manager', 'staff', NULL for all
  action_type_id UUID REFERENCES task_action_types(id), -- NULL for all types
  can_view BOOLEAN DEFAULT TRUE,
  can_edit BOOLEAN DEFAULT TRUE,
  can_assign BOOLEAN DEFAULT FALSE,
  can_delete BOOLEAN DEFAULT FALSE,
  organization_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, action_type_id, organization_id)
);

-- ============================================
-- 6. USER ROLE FIELD
-- ============================================

-- Add role field to users if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'staff';

-- ============================================
-- 7. TASK POOL SCOPES (for multiple pools)
-- ============================================

CREATE TABLE IF NOT EXISTS task_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  organization_id UUID NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add pool_id to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS pool_id UUID REFERENCES task_pools(id);

-- Create default pool
INSERT INTO task_pools (id, name, description, organization_id, is_default, is_active)
VALUES (
  'default-pool-0000-0000-000000000001',
  'Main Task Pool',
  'Default organization-wide task pool',
  'default-org-0000-0000-000000000001',
  TRUE,
  TRUE
) ON CONFLICT DO NOTHING;

-- ============================================
-- 8. ENHANCED TASK STATS VIEW
-- ============================================

CREATE OR REPLACE VIEW task_user_stats AS
SELECT
  u.id as user_id,
  u.full_name,
  u.email,
  COUNT(DISTINCT t.id) FILTER (WHERE t.assigned_to = u.id AND t.status = 'open') as assigned_open,
  COUNT(DISTINCT t.id) FILTER (WHERE t.assigned_to = u.id AND t.status = 'in_progress') as assigned_in_progress,
  COUNT(DISTINCT t.id) FILTER (WHERE t.assigned_to = u.id AND t.status = 'completed') as assigned_completed,
  COUNT(DISTINCT t.id) FILTER (WHERE t.claimed_by = u.id AND t.status != 'completed') as claimed_active,
  COUNT(DISTINCT t.id) FILTER (WHERE t.assigned_to = u.id AND t.due_date < CURRENT_DATE AND t.status != 'completed') as overdue,
  COUNT(DISTINCT t.id) FILTER (WHERE t.assigned_to = u.id AND t.due_date = CURRENT_DATE AND t.status != 'completed') as due_today,
  COUNT(DISTINCT t.id) FILTER (WHERE t.assigned_to = u.id AND t.priority = 'urgent' AND t.status != 'completed') as urgent_tasks,
  COUNT(DISTINCT t.id) FILTER (WHERE t.handoff_to = u.id) as pending_handoffs
FROM users u
LEFT JOIN tasks t ON t.assigned_to = u.id OR t.claimed_by = u.id OR t.handoff_to = u.id
GROUP BY u.id, u.full_name, u.email;

-- ============================================
-- 9. DISABLE RLS FOR NEW TABLES (for now)
-- ============================================

ALTER TABLE task_steps DISABLE ROW LEVEL SECURITY;
ALTER TABLE task_handoff_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_training_feedback DISABLE ROW LEVEL SECURITY;
ALTER TABLE task_visibility_rules DISABLE ROW LEVEL SECURITY;
ALTER TABLE task_pools DISABLE ROW LEVEL SECURITY;

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 'Migration complete!' as status;

-- Show new columns on tasks
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'tasks'
AND column_name IN ('parent_task_id', 'is_project', 'project_order', 'handoff_to', 'handoff_notes', 'handoff_at', 'pool_id');

-- Show new tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('task_steps', 'task_handoff_history', 'ai_training_feedback', 'task_visibility_rules', 'task_pools');
