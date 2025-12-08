-- TaskPool Database Migration - STEP 1
-- Run this FIRST in Supabase SQL Editor

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
