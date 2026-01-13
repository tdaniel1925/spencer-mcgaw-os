-- =====================================================
-- CALLS AND WEBHOOK TABLES MIGRATION
-- Created: 2025-12-29
-- Description: Creates the calls and webhook_logs tables
-- that are used by GoTo Connect and VAPI integrations
-- =====================================================

-- =====================================================
-- 0. FIX CLIENTS TABLE - Add alternate_phone column
-- Drizzle expects alternate_phone but foundation tables has mobile
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clients') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'alternate_phone') THEN
      ALTER TABLE clients ADD COLUMN alternate_phone VARCHAR(20);
      -- Copy data from mobile if it exists
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'mobile') THEN
        UPDATE clients SET alternate_phone = mobile WHERE mobile IS NOT NULL;
      END IF;
    END IF;
  END IF;
END $$;

-- =====================================================
-- 1. CALL STATUS ENUM
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'call_status') THEN
    CREATE TYPE call_status AS ENUM ('completed', 'missed', 'voicemail', 'transferred');
  END IF;
END $$;

-- =====================================================
-- 2. WEBHOOK STATUS ENUM
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'webhook_status') THEN
    CREATE TYPE webhook_status AS ENUM ('received', 'parsing', 'parsed', 'stored', 'failed');
  END IF;
END $$;

-- =====================================================
-- 3. CALLS TABLE
-- For AI Phone Agent and GoTo Connect integration
-- =====================================================
CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vapi_call_id VARCHAR(255) UNIQUE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  caller_phone VARCHAR(20),
  caller_name VARCHAR(255),
  status call_status NOT NULL,
  direction VARCHAR(20) NOT NULL DEFAULT 'inbound',
  duration INTEGER,
  transcription TEXT,
  summary TEXT,
  intent VARCHAR(100),
  sentiment VARCHAR(50),
  was_transferred BOOLEAN DEFAULT false,
  transferred_to_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  recording_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for calls table
CREATE INDEX IF NOT EXISTS idx_calls_client ON calls(client_id);
CREATE INDEX IF NOT EXISTS idx_calls_vapi_id ON calls(vapi_call_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_direction ON calls(direction);
CREATE INDEX IF NOT EXISTS idx_calls_created ON calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_caller_phone ON calls(caller_phone);

-- =====================================================
-- 4. WEBHOOK_LOGS TABLE
-- For monitoring webhook activity from external services
-- =====================================================
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint VARCHAR(100) NOT NULL,
  source VARCHAR(100),
  status webhook_status NOT NULL DEFAULT 'received',
  http_method VARCHAR(10) NOT NULL DEFAULT 'POST',
  headers JSONB,
  raw_payload JSONB,
  parsed_data JSONB,
  ai_parsing_used BOOLEAN DEFAULT false,
  ai_confidence INTEGER,
  ai_summary TEXT,
  ai_category VARCHAR(50),
  error_message TEXT,
  error_stack TEXT,
  processing_time_ms INTEGER,
  result_call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for webhook_logs table
CREATE INDEX IF NOT EXISTS idx_webhook_logs_endpoint ON webhook_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_source ON webhook_logs(source);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(status);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_result_call ON webhook_logs(result_call_id);

-- =====================================================
-- 5. ACTIVITY_LOGS TABLE (drizzle version)
-- For drizzle ORM activity logging
-- =====================================================
DO $$
BEGIN
  -- Check if activity_logs table exists (different from activity_log)
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activity_logs') THEN
    -- Create activity_type enum if not exists
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_type') THEN
      CREATE TYPE activity_type AS ENUM (
        'call_received',
        'call_made',
        'email_received',
        'email_sent',
        'document_received',
        'document_sent',
        'task_created',
        'task_completed',
        'client_created',
        'client_updated',
        'note_added',
        'form_submission',
        'webhook_received'
      );
    END IF;

    CREATE TABLE activity_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type activity_type NOT NULL,
      description TEXT NOT NULL,
      user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
      client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
      task_id UUID,
      call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
      document_id UUID,
      metadata JSONB,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_activity_logs_type ON activity_logs(type);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_client ON activity_logs(client_id);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_call ON activity_logs(call_id);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);
  END IF;
END $$;

-- =====================================================
-- 6. ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on tables
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- CALLS policies - allow authenticated users to view
CREATE POLICY "Authenticated users can view calls" ON calls
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can insert calls" ON calls
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can update calls" ON calls
  FOR UPDATE USING (true);

-- WEBHOOK_LOGS policies - admins only for viewing, service role for insert
CREATE POLICY "Admins can view webhook logs" ON webhook_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
  );

CREATE POLICY "Service role can manage webhook logs" ON webhook_logs
  FOR ALL WITH CHECK (true);

-- ACTIVITY_LOGS policies (if table was created)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activity_logs') THEN
    ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

    EXECUTE 'CREATE POLICY "Authenticated users can view activity logs" ON activity_logs FOR SELECT TO authenticated USING (true)';
    EXECUTE 'CREATE POLICY "Service role can insert activity logs" ON activity_logs FOR INSERT WITH CHECK (true)';
  END IF;
END $$;

-- =====================================================
-- 7. ADD REALTIME FOR CALLS
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'calls') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE calls;
  END IF;
END $$;

-- =====================================================
-- 8. FIX ACTIVITY_LOG TABLE - Add missing columns
-- The code expects resource_type, resource_name but table has entity_type
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activity_log') THEN
    -- Add resource_type if missing (alias for entity_type)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'activity_log' AND column_name = 'resource_type') THEN
      ALTER TABLE activity_log ADD COLUMN resource_type TEXT;
      -- Copy from entity_type if it exists
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'activity_log' AND column_name = 'entity_type') THEN
        UPDATE activity_log SET resource_type = entity_type WHERE resource_type IS NULL;
      END IF;
    END IF;

    -- Add resource_name if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'activity_log' AND column_name = 'resource_name') THEN
      ALTER TABLE activity_log ADD COLUMN resource_name TEXT;
    END IF;

    -- Add resource_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'activity_log' AND column_name = 'resource_id') THEN
      ALTER TABLE activity_log ADD COLUMN resource_id UUID;
      -- Copy from entity_id if it exists
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'activity_log' AND column_name = 'entity_id') THEN
        UPDATE activity_log SET resource_id = entity_id WHERE resource_id IS NULL;
      END IF;
    END IF;

    -- Add details column if missing (JSONB for extra data)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'activity_log' AND column_name = 'details') THEN
      ALTER TABLE activity_log ADD COLUMN details JSONB;
    END IF;

    -- Create indexes on new columns
    CREATE INDEX IF NOT EXISTS idx_activity_log_resource_type ON activity_log(resource_type);
    CREATE INDEX IF NOT EXISTS idx_activity_log_resource_id ON activity_log(resource_id);
  END IF;
END $$;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- This migration creates:
-- - calls table (17 columns) - for phone call logging
-- - webhook_logs table (17 columns) - for webhook monitoring
-- - activity_logs table (11 columns) - for drizzle activity logging
-- - Fixes activity_log table with missing columns
-- - Appropriate indexes and RLS policies
-- =====================================================
