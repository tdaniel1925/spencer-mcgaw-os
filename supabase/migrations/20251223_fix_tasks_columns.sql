-- Fix Tasks Columns Migration
-- Adds missing columns for RBAC and task management

-- Add created_by column if not exists
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add assigned_to column if not exists
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add claimed_by column if not exists
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS claimed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add client_id column if not exists (for client linking)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_claimed_by ON tasks(claimed_by);
CREATE INDEX IF NOT EXISTS idx_tasks_client_id ON tasks(client_id);

-- Add comments
COMMENT ON COLUMN tasks.created_by IS 'User who created the task';
COMMENT ON COLUMN tasks.assigned_to IS 'User the task is assigned to';
COMMENT ON COLUMN tasks.claimed_by IS 'User who claimed/accepted the task';
COMMENT ON COLUMN tasks.client_id IS 'Client this task is related to';
