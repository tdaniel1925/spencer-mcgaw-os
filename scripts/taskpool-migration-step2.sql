-- TaskPool Database Migration - STEP 2
-- Run this SECOND in Supabase SQL Editor (after step 1 completes)

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
