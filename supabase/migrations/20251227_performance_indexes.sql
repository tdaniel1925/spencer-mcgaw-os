-- =====================================================
-- Performance Indexes Migration
-- Created: 2025-12-27
-- Description: Adds indexes to speed up common dashboard queries
-- All indexes wrapped in safety checks for existing tables/columns
-- =====================================================

-- Tasks table indexes (with safety checks)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') THEN
    -- Basic column indexes
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
    CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at);
    CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at DESC);

    -- Composite indexes for common query patterns
    CREATE INDEX IF NOT EXISTS idx_tasks_status_due_date ON tasks(status, due_date);
    CREATE INDEX IF NOT EXISTS idx_tasks_status_completed_at ON tasks(status, completed_at);
    CREATE INDEX IF NOT EXISTS idx_tasks_status_priority ON tasks(status, priority);

    -- Partial indexes for active tasks (excluding completed/cancelled)
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tasks_active_due') THEN
      CREATE INDEX idx_tasks_active_due ON tasks(due_date)
        WHERE status NOT IN ('completed', 'cancelled');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tasks_active_priority') THEN
      CREATE INDEX idx_tasks_active_priority ON tasks(priority)
        WHERE status NOT IN ('completed', 'cancelled');
    END IF;
  END IF;
END $$;

-- User profile indexes (with safety checks)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
    CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
  END IF;
END $$;

-- Permission overrides indexes (with safety checks)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_permission_overrides') THEN
    CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_user ON user_permission_overrides(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_expires ON user_permission_overrides(user_id, expires_at);
  END IF;
END $$;

-- Activity log indexes for faster team activity feed (wrapped in DO block for safety)
DO $$
BEGIN
  -- Only create indexes if activity_log table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activity_log') THEN
    -- Basic created_at index
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_activity_log_created') THEN
      CREATE INDEX idx_activity_log_created ON activity_log(created_at DESC);
    END IF;

    -- User index
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_log' AND column_name = 'user_id') THEN
      IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_activity_log_user') THEN
        CREATE INDEX idx_activity_log_user ON activity_log(user_id, created_at DESC);
      END IF;
    END IF;

    -- Resource type index (only if column exists)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_log' AND column_name = 'resource_type') THEN
      IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_activity_log_resource') THEN
        CREATE INDEX idx_activity_log_resource ON activity_log(resource_type, created_at DESC);
      END IF;
    END IF;
  END IF;
END $$;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
