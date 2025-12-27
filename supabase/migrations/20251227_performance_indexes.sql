-- =====================================================
-- Performance Indexes Migration
-- Created: 2025-12-27
-- Description: Adds indexes to speed up common dashboard queries
-- =====================================================

-- Tasks table indexes for faster dashboard loading
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_tasks_status_due_date ON tasks(status, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status_completed_at ON tasks(status, completed_at);
CREATE INDEX IF NOT EXISTS idx_tasks_status_priority ON tasks(status, priority);

-- Partial indexes for active tasks (excluding completed/cancelled)
CREATE INDEX IF NOT EXISTS idx_tasks_active_due ON tasks(due_date)
  WHERE status NOT IN ('completed', 'cancelled');
CREATE INDEX IF NOT EXISTS idx_tasks_active_priority ON tasks(priority)
  WHERE status NOT IN ('completed', 'cancelled');

-- User profile lookup (used on every page load)
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

-- Permission overrides lookup (used on every page load)
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_user ON user_permission_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_expires ON user_permission_overrides(user_id, expires_at);

-- Activity log indexes for faster team activity feed
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_resource ON activity_log(resource_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id, created_at DESC);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
