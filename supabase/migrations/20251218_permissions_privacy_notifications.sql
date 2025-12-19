-- Migration: User Permissions, Privacy Settings, Notifications & Real-time
-- Created: 2025-12-18
-- Description: Adds tables for granular permissions, privacy controls, in-app notifications, and departments

-- ============================================================================
-- 1. DEPARTMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  manager_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for active departments
CREATE INDEX IF NOT EXISTS idx_departments_active ON departments(is_active) WHERE is_active = true;

-- ============================================================================
-- 2. USER_DEPARTMENTS TABLE (Many-to-Many)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, department_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_departments_user ON user_departments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_departments_dept ON user_departments(department_id);
CREATE INDEX IF NOT EXISTS idx_user_departments_primary ON user_departments(user_id, is_primary) WHERE is_primary = true;

-- ============================================================================
-- 3. USER_PERMISSION_OVERRIDES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  permission VARCHAR(100) NOT NULL, -- e.g., "tasks:assign", "clients:view_sensitive"
  granted BOOLEAN NOT NULL, -- true = allow, false = deny (overrides role default)
  granted_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  reason TEXT, -- Why this override was granted
  expires_at TIMESTAMPTZ, -- Optional expiration date
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, permission) -- One override per permission per user
);

-- Indexes for permission lookups
CREATE INDEX IF NOT EXISTS idx_permission_overrides_user ON user_permission_overrides(user_id);
-- Index for active (non-expired) permission overrides - expires_at check done at query time
CREATE INDEX IF NOT EXISTS idx_permission_overrides_expires ON user_permission_overrides(user_id, permission, expires_at);

-- ============================================================================
-- 4. USER_PRIVACY_SETTINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_privacy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES user_profiles(id) ON DELETE CASCADE,
  hide_tasks_from_peers BOOLEAN NOT NULL DEFAULT false,
  hide_activity_from_peers BOOLEAN NOT NULL DEFAULT false,
  hide_performance_from_peers BOOLEAN NOT NULL DEFAULT false,
  hide_calendar_from_peers BOOLEAN NOT NULL DEFAULT false,
  visible_to_user_ids UUID[] DEFAULT '{}', -- Users who can always see regardless of settings
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for privacy lookups
CREATE INDEX IF NOT EXISTS idx_privacy_settings_user ON user_privacy_settings(user_id);

-- ============================================================================
-- 5. NOTIFICATIONS TABLE (In-App Notifications)
-- ============================================================================
CREATE TYPE notification_type AS ENUM (
  'task_assigned',
  'task_completed',
  'task_status_changed',
  'task_due_soon',
  'task_overdue',
  'task_comment',
  'mention',
  'client_activity',
  'system_alert',
  'ai_suggestion'
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  link VARCHAR(500), -- Where to navigate on click
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  related_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  related_client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  triggered_by_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for notification queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC)
  WHERE is_read = false AND is_archived = false;
CREATE INDEX IF NOT EXISTS idx_notifications_user_recent ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_task ON notifications(related_task_id) WHERE related_task_id IS NOT NULL;

-- ============================================================================
-- 6. ADD ROLE COLUMN TO USER_PROFILES IF NOT EXISTS
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'staff';
  END IF;
END $$;

-- ============================================================================
-- 7. ENABLE REALTIME FOR RELEVANT TABLES
-- ============================================================================
-- Enable realtime for tables (if not already enabled)
DO $$
BEGIN
  -- Add tasks table to realtime if not already there
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
  END IF;

  -- Add notifications table to realtime if not already there
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;

-- ============================================================================
-- 8. ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_privacy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Departments: Everyone can view active departments
CREATE POLICY "View active departments" ON departments
  FOR SELECT USING (is_active = true);

-- Departments: Only admins can modify
CREATE POLICY "Admin manage departments" ON departments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- User Departments: Users can see their own, admins can see all
CREATE POLICY "View own department assignments" ON user_departments
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'manager')
    )
  );

-- User Departments: Only admins can modify
CREATE POLICY "Admin manage department assignments" ON user_departments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Permission Overrides: Users can view their own, admins can manage all
CREATE POLICY "View own permission overrides" ON user_permission_overrides
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admin manage permission overrides" ON user_permission_overrides
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Privacy Settings: Users manage their own, admins can view all
CREATE POLICY "Manage own privacy settings" ON user_privacy_settings
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Admin view privacy settings" ON user_privacy_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Notifications: Users can only see and manage their own
CREATE POLICY "View own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Update own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Service role can insert notifications for anyone
CREATE POLICY "Service insert notifications" ON notifications
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- 9. HELPER FUNCTIONS
-- ============================================================================

-- Function to get a user's effective permissions (role + overrides)
CREATE OR REPLACE FUNCTION get_user_permissions(target_user_id UUID)
RETURNS TABLE(permission VARCHAR, is_granted BOOLEAN, source VARCHAR) AS $$
BEGIN
  -- Return permission overrides for the user
  RETURN QUERY
  SELECT
    upo.permission,
    upo.granted as is_granted,
    'override'::VARCHAR as source
  FROM user_permission_overrides upo
  WHERE upo.user_id = target_user_id
    AND (upo.expires_at IS NULL OR upo.expires_at > NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can view another user's data based on privacy
CREATE OR REPLACE FUNCTION can_view_user_data(
  viewer_id UUID,
  target_user_id UUID,
  data_type VARCHAR -- 'tasks', 'activity', 'performance', 'calendar'
) RETURNS BOOLEAN AS $$
DECLARE
  viewer_role VARCHAR;
  privacy_setting BOOLEAN;
  visible_users UUID[];
BEGIN
  -- Same user can always view their own data
  IF viewer_id = target_user_id THEN
    RETURN true;
  END IF;

  -- Get viewer's role
  SELECT role INTO viewer_role FROM user_profiles WHERE id = viewer_id;

  -- Admins and owners can always view
  IF viewer_role IN ('owner', 'admin') THEN
    RETURN true;
  END IF;

  -- Check target user's privacy settings
  SELECT
    CASE data_type
      WHEN 'tasks' THEN hide_tasks_from_peers
      WHEN 'activity' THEN hide_activity_from_peers
      WHEN 'performance' THEN hide_performance_from_peers
      WHEN 'calendar' THEN hide_calendar_from_peers
      ELSE false
    END,
    visible_to_user_ids
  INTO privacy_setting, visible_users
  FROM user_privacy_settings
  WHERE user_id = target_user_id;

  -- If no privacy settings exist, default to visible
  IF NOT FOUND THEN
    RETURN true;
  END IF;

  -- If privacy is enabled, check if viewer is in allowed list
  IF privacy_setting THEN
    RETURN viewer_id = ANY(visible_users);
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 10. TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to new tables
CREATE TRIGGER update_departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_permission_overrides_updated_at
  BEFORE UPDATE ON user_permission_overrides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_privacy_settings_updated_at
  BEFORE UPDATE ON user_privacy_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 11. SEED DEFAULT DEPARTMENTS (Optional)
-- ============================================================================
INSERT INTO departments (name, description) VALUES
  ('Tax Preparation', 'Individual and business tax preparation services'),
  ('Bookkeeping', 'Monthly bookkeeping and reconciliation'),
  ('Payroll', 'Payroll processing and tax filings'),
  ('Advisory', 'Financial consulting and advisory services'),
  ('Client Services', 'Client communication and support')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
