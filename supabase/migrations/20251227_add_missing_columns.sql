-- =====================================================
-- ADD MISSING COLUMNS TO EXISTING TABLES
-- Created: 2025-12-27
-- Description: Adds columns that may be missing from
-- tables that already exist in the database.
-- Each section checks if the table exists first.
-- =====================================================

-- =====================================================
-- TASK_ACTION_TYPES TABLE - Add missing columns
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_action_types') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'task_action_types' AND column_name = 'sort_order') THEN
      ALTER TABLE task_action_types ADD COLUMN sort_order INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'task_action_types' AND column_name = 'organization_id') THEN
      ALTER TABLE task_action_types ADD COLUMN organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000001';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'task_action_types' AND column_name = 'is_active') THEN
      ALTER TABLE task_action_types ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'task_action_types' AND column_name = 'icon') THEN
      ALTER TABLE task_action_types ADD COLUMN icon TEXT DEFAULT 'clipboard';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'task_action_types' AND column_name = 'color') THEN
      ALTER TABLE task_action_types ADD COLUMN color TEXT DEFAULT '#6B7280';
    END IF;
  END IF;
END $$;

-- =====================================================
-- TASKS TABLE - Add missing columns
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'assigned_to') THEN
      ALTER TABLE tasks ADD COLUMN assigned_to UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'claimed_by') THEN
      ALTER TABLE tasks ADD COLUMN claimed_by UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'claimed_at') THEN
      ALTER TABLE tasks ADD COLUMN claimed_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'client_id') THEN
      ALTER TABLE tasks ADD COLUMN client_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'source_type') THEN
      ALTER TABLE tasks ADD COLUMN source_type TEXT DEFAULT 'manual';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'due_time') THEN
      ALTER TABLE tasks ADD COLUMN due_time TIME;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'alert_threshold_hours') THEN
      ALTER TABLE tasks ADD COLUMN alert_threshold_hours INTEGER DEFAULT 24;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'started_at') THEN
      ALTER TABLE tasks ADD COLUMN started_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'estimated_minutes') THEN
      ALTER TABLE tasks ADD COLUMN estimated_minutes INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'actual_minutes') THEN
      ALTER TABLE tasks ADD COLUMN actual_minutes INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'progress_percent') THEN
      ALTER TABLE tasks ADD COLUMN progress_percent INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'parent_task_id') THEN
      ALTER TABLE tasks ADD COLUMN parent_task_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'tags') THEN
      ALTER TABLE tasks ADD COLUMN tags TEXT[] DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'custom_fields') THEN
      ALTER TABLE tasks ADD COLUMN custom_fields JSONB DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'created_by') THEN
      ALTER TABLE tasks ADD COLUMN created_by UUID;
    END IF;
  END IF;
END $$;

-- =====================================================
-- USER_PROFILES TABLE - Add missing columns
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'first_name') THEN
      ALTER TABLE user_profiles ADD COLUMN first_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'last_name') THEN
      ALTER TABLE user_profiles ADD COLUMN last_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'phone') THEN
      ALTER TABLE user_profiles ADD COLUMN phone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'job_title') THEN
      ALTER TABLE user_profiles ADD COLUMN job_title TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'department') THEN
      ALTER TABLE user_profiles ADD COLUMN department TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'role') THEN
      ALTER TABLE user_profiles ADD COLUMN role TEXT DEFAULT 'staff';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'is_active') THEN
      ALTER TABLE user_profiles ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'hire_date') THEN
      ALTER TABLE user_profiles ADD COLUMN hire_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'timezone') THEN
      ALTER TABLE user_profiles ADD COLUMN timezone TEXT DEFAULT 'America/Chicago';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'preferences') THEN
      ALTER TABLE user_profiles ADD COLUMN preferences JSONB DEFAULT '{}';
    END IF;
  END IF;
END $$;

-- =====================================================
-- CLIENTS TABLE - Add missing columns
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'client_type') THEN
      ALTER TABLE clients ADD COLUMN client_type TEXT DEFAULT 'individual';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'industry') THEN
      ALTER TABLE clients ADD COLUMN industry TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'tax_id') THEN
      ALTER TABLE clients ADD COLUMN tax_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'tax_id_type') THEN
      ALTER TABLE clients ADD COLUMN tax_id_type TEXT DEFAULT 'ssn';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'status') THEN
      ALTER TABLE clients ADD COLUMN status TEXT DEFAULT 'active';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'client_since') THEN
      ALTER TABLE clients ADD COLUMN client_since DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'last_contact_date') THEN
      ALTER TABLE clients ADD COLUMN last_contact_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'next_follow_up') THEN
      ALTER TABLE clients ADD COLUMN next_follow_up DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'assigned_to') THEN
      ALTER TABLE clients ADD COLUMN assigned_to UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'billing_rate') THEN
      ALTER TABLE clients ADD COLUMN billing_rate DECIMAL(10,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'payment_terms') THEN
      ALTER TABLE clients ADD COLUMN payment_terms TEXT DEFAULT 'net30';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'tags') THEN
      ALTER TABLE clients ADD COLUMN tags TEXT[] DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'custom_fields') THEN
      ALTER TABLE clients ADD COLUMN custom_fields JSONB DEFAULT '{}';
    END IF;
  END IF;
END $$;

-- =====================================================
-- CHAT_MESSAGES TABLE - Add missing columns
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_messages') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'is_edited') THEN
      ALTER TABLE chat_messages ADD COLUMN is_edited BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'reply_to_id') THEN
      ALTER TABLE chat_messages ADD COLUMN reply_to_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'thread_id') THEN
      ALTER TABLE chat_messages ADD COLUMN thread_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'metadata') THEN
      ALTER TABLE chat_messages ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
  END IF;
END $$;

-- =====================================================
-- CHAT_ROOMS TABLE - Add missing columns
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_rooms') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_rooms' AND column_name = 'type') THEN
      ALTER TABLE chat_rooms ADD COLUMN type TEXT DEFAULT 'community';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_rooms' AND column_name = 'is_private') THEN
      ALTER TABLE chat_rooms ADD COLUMN is_private BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_rooms' AND column_name = 'is_archived') THEN
      ALTER TABLE chat_rooms ADD COLUMN is_archived BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_rooms' AND column_name = 'slug') THEN
      ALTER TABLE chat_rooms ADD COLUMN slug TEXT;
      UPDATE chat_rooms SET slug = LOWER(REPLACE(name, ' ', '-')) WHERE slug IS NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_rooms' AND column_name = 'description') THEN
      ALTER TABLE chat_rooms ADD COLUMN description TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_rooms' AND column_name = 'icon') THEN
      ALTER TABLE chat_rooms ADD COLUMN icon TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_rooms' AND column_name = 'color') THEN
      ALTER TABLE chat_rooms ADD COLUMN color TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_rooms' AND column_name = 'participant_ids') THEN
      ALTER TABLE chat_rooms ADD COLUMN participant_ids UUID[] DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_rooms' AND column_name = 'last_message_at') THEN
      ALTER TABLE chat_rooms ADD COLUMN last_message_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_rooms' AND column_name = 'message_count') THEN
      ALTER TABLE chat_rooms ADD COLUMN message_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_rooms' AND column_name = 'created_by') THEN
      ALTER TABLE chat_rooms ADD COLUMN created_by UUID;
    END IF;
  END IF;
END $$;

-- =====================================================
-- EMAIL_CONNECTIONS TABLE - Add missing columns
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_connections') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_connections' AND column_name = 'is_global') THEN
      ALTER TABLE email_connections ADD COLUMN is_global BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_connections' AND column_name = 'display_order') THEN
      ALTER TABLE email_connections ADD COLUMN display_order INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_connections' AND column_name = 'description') THEN
      ALTER TABLE email_connections ADD COLUMN description TEXT;
    END IF;
  END IF;
END $$;

-- =====================================================
-- EMAIL_CLASSIFICATIONS TABLE - Add missing columns
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_classifications') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_classifications' AND column_name = 'from_name') THEN
      ALTER TABLE email_classifications ADD COLUMN from_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_classifications' AND column_name = 'from_email') THEN
      ALTER TABLE email_classifications ADD COLUMN from_email TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_classifications' AND column_name = 'email_id') THEN
      ALTER TABLE email_classifications ADD COLUMN email_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_classifications' AND column_name = 'to_emails') THEN
      ALTER TABLE email_classifications ADD COLUMN to_emails TEXT[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_classifications' AND column_name = 'cc_emails') THEN
      ALTER TABLE email_classifications ADD COLUMN cc_emails TEXT[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_classifications' AND column_name = 'confidence') THEN
      ALTER TABLE email_classifications ADD COLUMN confidence DECIMAL(3,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_classifications' AND column_name = 'matched_client_id') THEN
      ALTER TABLE email_classifications ADD COLUMN matched_client_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_classifications' AND column_name = 'matched_contact_id') THEN
      ALTER TABLE email_classifications ADD COLUMN matched_contact_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_classifications' AND column_name = 'requires_response') THEN
      ALTER TABLE email_classifications ADD COLUMN requires_response BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_classifications' AND column_name = 'action_items') THEN
      ALTER TABLE email_classifications ADD COLUMN action_items JSONB DEFAULT '[]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_classifications' AND column_name = 'is_read') THEN
      ALTER TABLE email_classifications ADD COLUMN is_read BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_classifications' AND column_name = 'is_archived') THEN
      ALTER TABLE email_classifications ADD COLUMN is_archived BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_classifications' AND column_name = 'is_starred') THEN
      ALTER TABLE email_classifications ADD COLUMN is_starred BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_classifications' AND column_name = 'user_classification') THEN
      ALTER TABLE email_classifications ADD COLUMN user_classification TEXT;
    END IF;
  END IF;
END $$;

-- =====================================================
-- Create indexes for new columns (safe - checks table exists first)
-- =====================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tasks_assigned_to') THEN
      CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tasks_claimed_by') THEN
      CREATE INDEX idx_tasks_claimed_by ON tasks(claimed_by);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tasks_client_id') THEN
      CREATE INDEX idx_tasks_client_id ON tasks(client_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_tasks_parent') THEN
      CREATE INDEX idx_tasks_parent ON tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_classifications') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_email_class_email_id') THEN
      CREATE INDEX idx_email_class_email_id ON email_classifications(email_id);
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_connections') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_email_connections_global') THEN
      CREATE INDEX idx_email_connections_global ON email_connections(is_global) WHERE is_global = true;
    END IF;
  END IF;
END $$;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- This migration safely adds missing columns to existing
-- tables. Each section first checks if the table exists,
-- then adds columns only if they don't already exist.
-- Safe to run multiple times.
-- =====================================================
