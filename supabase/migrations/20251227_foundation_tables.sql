-- =====================================================
-- FOUNDATION TABLES MIGRATION
-- Created: 2025-12-27
-- Description: Creates all core tables that were missing
-- from the migration system. This consolidates tables
-- that were previously only in scripts or referenced
-- but never created.
-- =====================================================

-- =====================================================
-- STEP 0: ADD MISSING COLUMNS TO EXISTING TABLES FIRST
-- This MUST run before any CREATE TABLE or other statements
-- to ensure existing tables have required columns
-- =====================================================
DO $$
BEGIN
  -- CHAT_ROOMS: Add all potentially missing columns
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chat_rooms') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_rooms' AND column_name = 'type') THEN
      ALTER TABLE chat_rooms ADD COLUMN type TEXT DEFAULT 'community';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_rooms' AND column_name = 'is_archived') THEN
      ALTER TABLE chat_rooms ADD COLUMN is_archived BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_rooms' AND column_name = 'slug') THEN
      ALTER TABLE chat_rooms ADD COLUMN slug TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_rooms' AND column_name = 'is_private') THEN
      ALTER TABLE chat_rooms ADD COLUMN is_private BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_rooms' AND column_name = 'description') THEN
      ALTER TABLE chat_rooms ADD COLUMN description TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_rooms' AND column_name = 'icon') THEN
      ALTER TABLE chat_rooms ADD COLUMN icon TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_rooms' AND column_name = 'color') THEN
      ALTER TABLE chat_rooms ADD COLUMN color TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_rooms' AND column_name = 'participant_ids') THEN
      ALTER TABLE chat_rooms ADD COLUMN participant_ids UUID[] DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_rooms' AND column_name = 'last_message_at') THEN
      ALTER TABLE chat_rooms ADD COLUMN last_message_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_rooms' AND column_name = 'message_count') THEN
      ALTER TABLE chat_rooms ADD COLUMN message_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_rooms' AND column_name = 'created_by') THEN
      ALTER TABLE chat_rooms ADD COLUMN created_by UUID;
    END IF;
    -- Update slug for existing rows
    UPDATE chat_rooms SET slug = LOWER(REPLACE(name, ' ', '-')) WHERE slug IS NULL;
  END IF;

  -- EMAIL_CONNECTIONS: Add is_global if missing
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'email_connections') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_connections' AND column_name = 'is_global') THEN
      ALTER TABLE email_connections ADD COLUMN is_global BOOLEAN DEFAULT false;
    END IF;
  END IF;

  -- USER_PROFILES: Add role if missing
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profiles') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'role') THEN
      ALTER TABLE user_profiles ADD COLUMN role TEXT DEFAULT 'staff';
    END IF;
  END IF;
END $$;

-- =====================================================
-- 1. USER_PROFILES TABLE
-- Core user data extending Supabase auth.users
-- =====================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  job_title TEXT,
  department TEXT,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'admin', 'manager', 'staff')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  hire_date DATE,
  timezone TEXT DEFAULT 'America/Chicago',
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_active ON user_profiles(is_active) WHERE is_active = true;

-- =====================================================
-- 2. CLIENTS TABLE
-- Main client/customer records
-- =====================================================
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic Info
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  display_name TEXT GENERATED ALWAYS AS (
    COALESCE(company, CONCAT(first_name, ' ', last_name))
  ) STORED,

  -- Contact Info
  email TEXT,
  phone TEXT,
  mobile TEXT,
  fax TEXT,
  website TEXT,

  -- Address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'USA',

  -- Business Info
  client_type TEXT DEFAULT 'individual' CHECK (client_type IN ('individual', 'business', 'trust', 'estate', 'nonprofit')),
  industry TEXT,
  tax_id TEXT,
  tax_id_type TEXT DEFAULT 'ssn' CHECK (tax_id_type IN ('ssn', 'ein', 'itin')),

  -- Status & Dates
  status TEXT DEFAULT 'active' CHECK (status IN ('prospect', 'active', 'inactive', 'archived')),
  client_since DATE,
  last_contact_date DATE,
  next_follow_up DATE,

  -- Assignment
  primary_contact_id UUID,
  assigned_to UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,

  -- Billing
  billing_rate DECIMAL(10,2),
  payment_terms TEXT DEFAULT 'net30',

  -- Notes & Tags
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_company ON clients(company);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_assigned_to ON clients(assigned_to);
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON clients(created_by);
CREATE INDEX IF NOT EXISTS idx_clients_type ON clients(client_type);

-- =====================================================
-- 3. CLIENT_CONTACTS TABLE
-- Additional contacts within a client organization
-- =====================================================
CREATE TABLE IF NOT EXISTS client_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Contact Info
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  mobile TEXT,

  -- Role
  job_title TEXT,
  department TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_billing_contact BOOLEAN NOT NULL DEFAULT false,

  -- Communication Preferences
  preferred_contact_method TEXT DEFAULT 'email' CHECK (preferred_contact_method IN ('email', 'phone', 'mobile', 'mail')),
  can_receive_marketing BOOLEAN DEFAULT true,

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_contacts_client ON client_contacts(client_id);
CREATE INDEX IF NOT EXISTS idx_client_contacts_email ON client_contacts(email);
CREATE INDEX IF NOT EXISTS idx_client_contacts_primary ON client_contacts(client_id, is_primary) WHERE is_primary = true;

-- Update clients.primary_contact_id FK now that client_contacts exists
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_primary_contact_id_fkey;
ALTER TABLE clients ADD CONSTRAINT clients_primary_contact_id_fkey
  FOREIGN KEY (primary_contact_id) REFERENCES client_contacts(id) ON DELETE SET NULL;

-- =====================================================
-- 4. CLIENT_COMMUNICATIONS TABLE
-- Communication history with clients
-- =====================================================
CREATE TABLE IF NOT EXISTS client_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES client_contacts(id) ON DELETE SET NULL,

  -- Communication Details
  type TEXT NOT NULL CHECK (type IN ('email', 'phone', 'meeting', 'sms', 'letter', 'portal', 'other')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  subject TEXT,
  content TEXT,
  summary TEXT,

  -- Metadata
  duration_minutes INTEGER,
  attachments JSONB DEFAULT '[]',

  -- Associated Records
  related_task_id UUID,
  related_email_id TEXT,

  -- User Info
  performed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,

  -- Timestamps
  communication_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_comms_client ON client_communications(client_id);
CREATE INDEX IF NOT EXISTS idx_client_comms_type ON client_communications(type);
CREATE INDEX IF NOT EXISTS idx_client_comms_date ON client_communications(communication_date DESC);

-- =====================================================
-- 5. CHAT_ROOMS TABLE
-- Chat room definitions (using dynamic SQL to avoid parse-time issues)
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chat_rooms') THEN
    EXECUTE '
      CREATE TABLE chat_rooms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        description TEXT,
        type TEXT NOT NULL DEFAULT ''community'' CHECK (type IN (''community'', ''team'', ''direct'', ''private'')),
        is_private BOOLEAN NOT NULL DEFAULT false,
        is_archived BOOLEAN NOT NULL DEFAULT false,
        icon TEXT,
        color TEXT,
        participant_ids UUID[] DEFAULT ''{}'',
        last_message_at TIMESTAMPTZ,
        message_count INTEGER NOT NULL DEFAULT 0,
        created_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    ';
    -- Add FK constraint separately to avoid issues with user_profiles reference
    EXECUTE 'ALTER TABLE chat_rooms ADD CONSTRAINT chat_rooms_created_by_fkey FOREIGN KEY (created_by) REFERENCES user_profiles(id) ON DELETE SET NULL';
  END IF;
END $$;

-- NOTE: Indexes on type, slug, is_archived are created later after columns are ensured to exist

-- =====================================================
-- 6. CHAT_MESSAGES TABLE
-- Individual chat messages
-- =====================================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- Message Content
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system', 'announcement')),

  -- Reply/Thread
  reply_to_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  thread_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,

  -- Edit/Delete
  is_edited BOOLEAN NOT NULL DEFAULT false,
  edited_at TIMESTAMPTZ,
  original_content TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT false,

  -- Attachments
  attachments JSONB DEFAULT '[]',

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id) WHERE thread_id IS NOT NULL;

-- =====================================================
-- 7. CHAT_ROOM_MEMBERS TABLE
-- Room membership and permissions
-- =====================================================
CREATE TABLE IF NOT EXISTS chat_room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- Role & Permissions
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
  can_post BOOLEAN NOT NULL DEFAULT true,

  -- Status
  is_muted BOOLEAN NOT NULL DEFAULT false,
  muted_until TIMESTAMPTZ,

  -- Read Tracking
  last_read_at TIMESTAMPTZ,
  last_read_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,

  -- Timestamps
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_room_members_room ON chat_room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_room_members_user ON chat_room_members(user_id);

-- =====================================================
-- 8. CHAT_TYPING_INDICATORS TABLE
-- Real-time typing status
-- =====================================================
CREATE TABLE IF NOT EXISTS chat_typing_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_typing_room ON chat_typing_indicators(room_id);

-- =====================================================
-- 9. EMAIL_CONNECTIONS TABLE
-- OAuth connections to email providers
-- =====================================================
CREATE TABLE IF NOT EXISTS email_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- Provider Info
  provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft', 'imap')),
  email TEXT NOT NULL,

  -- OAuth Tokens
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,

  -- IMAP Settings (for non-OAuth)
  imap_host TEXT,
  imap_port INTEGER,
  smtp_host TEXT,
  smtp_port INTEGER,

  -- Sync Settings
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  sync_from_date DATE,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_global BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER DEFAULT 0,
  description TEXT,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, email)
);

CREATE INDEX IF NOT EXISTS idx_email_connections_user ON email_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_email_connections_provider ON email_connections(provider);
CREATE INDEX IF NOT EXISTS idx_email_connections_global ON email_connections(is_global) WHERE is_global = true;

-- =====================================================
-- 10. EMAIL_CLASSIFICATIONS TABLE
-- AI-classified email metadata
-- =====================================================
CREATE TABLE IF NOT EXISTS email_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES email_connections(id) ON DELETE CASCADE,

  -- Email Identifiers
  email_id TEXT NOT NULL,
  thread_id TEXT,
  message_id TEXT,

  -- Email Metadata
  subject TEXT,
  from_email TEXT,
  from_name TEXT,
  to_emails TEXT[],
  cc_emails TEXT[],
  received_at TIMESTAMPTZ,

  -- Classification
  classification TEXT NOT NULL CHECK (classification IN ('client', 'internal', 'marketing', 'spam', 'unknown')),
  category TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
  confidence DECIMAL(3,2),

  -- Client Matching
  matched_client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  matched_contact_id UUID REFERENCES client_contacts(id) ON DELETE SET NULL,

  -- Action Items
  requires_response BOOLEAN DEFAULT false,
  action_items JSONB DEFAULT '[]',

  -- User Actions
  is_read BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  user_classification TEXT,

  -- Timestamps
  classified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(account_id, email_id)
);

CREATE INDEX IF NOT EXISTS idx_email_class_account ON email_classifications(account_id);
CREATE INDEX IF NOT EXISTS idx_email_class_classification ON email_classifications(classification);
CREATE INDEX IF NOT EXISTS idx_email_class_client ON email_classifications(matched_client_id) WHERE matched_client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_class_received ON email_classifications(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_class_email_id ON email_classifications(email_id);

-- =====================================================
-- 11. SMS TABLES
-- SMS/Text messaging system
-- =====================================================

-- SMS Settings per user
CREATE TABLE IF NOT EXISTS sms_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- Twilio Configuration
  twilio_phone_number TEXT,
  twilio_account_sid TEXT,
  twilio_auth_token TEXT,

  -- Settings
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  auto_reply_enabled BOOLEAN NOT NULL DEFAULT false,
  auto_reply_message TEXT,
  business_hours_only BOOLEAN NOT NULL DEFAULT false,
  business_hours_start TIME DEFAULT '09:00',
  business_hours_end TIME DEFAULT '17:00',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SMS Conversations
CREATE TABLE IF NOT EXISTS sms_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- Contact Info
  phone_number TEXT NOT NULL,
  contact_name TEXT,

  -- Associated Records
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES client_contacts(id) ON DELETE SET NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'blocked')),
  is_opted_out BOOLEAN NOT NULL DEFAULT false,

  -- Tracking
  last_message_at TIMESTAMPTZ,
  unread_count INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_sms_convos_user ON sms_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_convos_phone ON sms_conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_convos_client ON sms_conversations(client_id) WHERE client_id IS NOT NULL;

-- SMS Messages
CREATE TABLE IF NOT EXISTS sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES sms_conversations(id) ON DELETE CASCADE,

  -- Message Content
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body TEXT NOT NULL,
  media_urls TEXT[] DEFAULT '{}',

  -- Twilio Metadata
  twilio_sid TEXT,
  twilio_status TEXT,
  error_code TEXT,
  error_message TEXT,

  -- Status
  is_read BOOLEAN NOT NULL DEFAULT false,

  -- Timestamps
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_messages_convo ON sms_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_sent ON sms_messages(sent_at DESC);

-- SMS Opt-Out Log
CREATE TABLE IF NOT EXISTS sms_opt_out_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('opt_out', 'opt_in')),
  reason TEXT,
  performed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_optout_phone ON sms_opt_out_log(phone_number);

-- SMS Auto Responders
CREATE TABLE IF NOT EXISTS sms_auto_responders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- Trigger
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('keyword', 'after_hours', 'first_message', 'always')),
  trigger_keyword TEXT,

  -- Response
  response_message TEXT NOT NULL,

  -- Settings
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_auto_user ON sms_auto_responders(user_id);

-- =====================================================
-- 12. ACTIVITY_LOG TABLE
-- General activity/audit logging
-- =====================================================
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Actor
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,

  -- Action Details
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,

  -- Context
  description TEXT,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB DEFAULT '{}',

  -- Request Info
  ip_address INET,
  user_agent TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);

-- =====================================================
-- 13. NOTIFICATION_PREFERENCES TABLE
-- User notification preferences
-- =====================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- Email Notifications
  email_task_assigned BOOLEAN NOT NULL DEFAULT true,
  email_task_completed BOOLEAN NOT NULL DEFAULT true,
  email_task_due_soon BOOLEAN NOT NULL DEFAULT true,
  email_mentions BOOLEAN NOT NULL DEFAULT true,
  email_client_activity BOOLEAN NOT NULL DEFAULT false,
  email_daily_digest BOOLEAN NOT NULL DEFAULT true,
  email_weekly_summary BOOLEAN NOT NULL DEFAULT true,

  -- In-App Notifications
  app_task_assigned BOOLEAN NOT NULL DEFAULT true,
  app_task_completed BOOLEAN NOT NULL DEFAULT true,
  app_task_due_soon BOOLEAN NOT NULL DEFAULT true,
  app_mentions BOOLEAN NOT NULL DEFAULT true,
  app_chat_messages BOOLEAN NOT NULL DEFAULT true,
  app_client_activity BOOLEAN NOT NULL DEFAULT true,

  -- Push Notifications
  push_enabled BOOLEAN NOT NULL DEFAULT false,
  push_task_assigned BOOLEAN NOT NULL DEFAULT true,
  push_mentions BOOLEAN NOT NULL DEFAULT true,
  push_chat_messages BOOLEAN NOT NULL DEFAULT true,

  -- Quiet Hours
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '07:00',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 14. PROJECTS TABLE
-- Project management
-- =====================================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic Info
  name TEXT NOT NULL,
  description TEXT,

  -- Client Association
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,

  -- Status & Dates
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
  start_date DATE,
  due_date DATE,
  completed_date DATE,

  -- Assignment
  project_manager_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  team_member_ids UUID[] DEFAULT '{}',

  -- Budget & Time
  budget_amount DECIMAL(12,2),
  budget_hours DECIMAL(8,2),
  actual_hours DECIMAL(8,2) DEFAULT 0,

  -- Customization
  color TEXT,
  icon TEXT,
  tags TEXT[] DEFAULT '{}',

  -- Metadata
  settings JSONB DEFAULT '{}',

  -- Timestamps
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_manager ON projects(project_manager_id);

-- =====================================================
-- 15. PROJECT_TASKS TABLE
-- Link tasks to projects
-- =====================================================
CREATE TABLE IF NOT EXISTS project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id UUID NOT NULL,  -- Will reference tasks table

  -- Ordering
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Phase/Section
  phase TEXT,

  -- Timestamps
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,

  UNIQUE(project_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_task ON project_tasks(task_id);

-- Create chat_rooms indexes (using dynamic SQL to avoid parse-time column validation)
DO $$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_chat_rooms_type ON chat_rooms(type)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_chat_rooms_slug ON chat_rooms(slug)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_chat_rooms_archived ON chat_rooms(is_archived) WHERE is_archived = false';
END $$;

-- =====================================================
-- ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_typing_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_opt_out_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_auto_responders ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;

-- USER_PROFILES policies
CREATE POLICY "Users can view all profiles" ON user_profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Service role can insert profiles" ON user_profiles
  FOR INSERT WITH CHECK (true);

-- CLIENTS policies
CREATE POLICY "Authenticated users can view clients" ON clients
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert clients" ON clients
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update clients" ON clients
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Admins can delete clients" ON clients
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- CLIENT_CONTACTS policies
CREATE POLICY "Authenticated users can view contacts" ON client_contacts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage contacts" ON client_contacts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- CLIENT_COMMUNICATIONS policies
CREATE POLICY "Authenticated users can view communications" ON client_communications
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert communications" ON client_communications
  FOR INSERT TO authenticated WITH CHECK (true);

-- CHAT_ROOMS policies (using dynamic SQL to avoid parse-time column validation)
DO $$
BEGIN
  -- Drop existing policies first to avoid conflicts
  DROP POLICY IF EXISTS "View public/community rooms" ON chat_rooms;
  DROP POLICY IF EXISTS "View rooms user is member of" ON chat_rooms;
  DROP POLICY IF EXISTS "Create rooms" ON chat_rooms;
  DROP POLICY IF EXISTS "Update own rooms" ON chat_rooms;

  EXECUTE 'CREATE POLICY "View public/community rooms" ON chat_rooms FOR SELECT USING (type = ''community'' AND is_archived = false)';
  EXECUTE 'CREATE POLICY "View rooms user is member of" ON chat_rooms FOR SELECT USING (EXISTS (SELECT 1 FROM chat_room_members WHERE room_id = id AND user_id = auth.uid()))';
  EXECUTE 'CREATE POLICY "Create rooms" ON chat_rooms FOR INSERT TO authenticated WITH CHECK (true)';
  EXECUTE 'CREATE POLICY "Update own rooms" ON chat_rooms FOR UPDATE USING (created_by = auth.uid())';
END $$;

-- CHAT_MESSAGES policies (using dynamic SQL)
DO $$
BEGIN
  DROP POLICY IF EXISTS "View messages in accessible rooms" ON chat_messages;
  DROP POLICY IF EXISTS "Send messages to accessible rooms" ON chat_messages;
  DROP POLICY IF EXISTS "Update own messages" ON chat_messages;

  EXECUTE 'CREATE POLICY "View messages in accessible rooms" ON chat_messages FOR SELECT USING (EXISTS (SELECT 1 FROM chat_rooms r WHERE r.id = room_id AND (r.type = ''community'' OR EXISTS (SELECT 1 FROM chat_room_members WHERE room_id = r.id AND user_id = auth.uid()))))';
  EXECUTE 'CREATE POLICY "Send messages to accessible rooms" ON chat_messages FOR INSERT WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM chat_rooms r WHERE r.id = room_id AND (r.type = ''community'' OR EXISTS (SELECT 1 FROM chat_room_members WHERE room_id = r.id AND user_id = auth.uid()))))';
  EXECUTE 'CREATE POLICY "Update own messages" ON chat_messages FOR UPDATE USING (user_id = auth.uid())';
END $$;

-- CHAT_ROOM_MEMBERS policies (using dynamic SQL)
DO $$
BEGIN
  DROP POLICY IF EXISTS "View room members" ON chat_room_members;
  DROP POLICY IF EXISTS "Join community rooms" ON chat_room_members;
  DROP POLICY IF EXISTS "Manage own membership" ON chat_room_members;

  EXECUTE 'CREATE POLICY "View room members" ON chat_room_members FOR SELECT TO authenticated USING (true)';
  EXECUTE 'CREATE POLICY "Join community rooms" ON chat_room_members FOR INSERT WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM chat_rooms WHERE id = room_id AND type = ''community''))';
  EXECUTE 'CREATE POLICY "Manage own membership" ON chat_room_members FOR ALL USING (user_id = auth.uid())';
END $$;

-- CHAT_TYPING_INDICATORS policies
CREATE POLICY "View typing" ON chat_typing_indicators
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Set own typing" ON chat_typing_indicators
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Delete own typing" ON chat_typing_indicators
  FOR DELETE USING (user_id = auth.uid());

-- EMAIL_CONNECTIONS policies (using dynamic SQL)
DO $$
BEGIN
  DROP POLICY IF EXISTS "View own connections" ON email_connections;
  DROP POLICY IF EXISTS "Manage own connections" ON email_connections;

  EXECUTE 'CREATE POLICY "View own connections" ON email_connections FOR SELECT USING (user_id = auth.uid() OR is_global = true)';
  EXECUTE 'CREATE POLICY "Manage own connections" ON email_connections FOR ALL USING (user_id = auth.uid())';
END $$;

-- EMAIL_CLASSIFICATIONS policies (using dynamic SQL)
DO $$
BEGIN
  DROP POLICY IF EXISTS "View own or global classifications" ON email_classifications;
  DROP POLICY IF EXISTS "Manage own classifications" ON email_classifications;

  EXECUTE 'CREATE POLICY "View own or global classifications" ON email_classifications FOR SELECT USING (account_id IN (SELECT id FROM email_connections WHERE user_id = auth.uid()) OR account_id IN (SELECT id FROM email_connections WHERE is_global = true))';
  EXECUTE 'CREATE POLICY "Manage own classifications" ON email_classifications FOR ALL USING (account_id IN (SELECT id FROM email_connections WHERE user_id = auth.uid()))';
END $$;

-- SMS tables policies
CREATE POLICY "View own SMS settings" ON sms_settings
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Manage own SMS settings" ON sms_settings
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "View own SMS conversations" ON sms_conversations
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Manage own SMS conversations" ON sms_conversations
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "View own SMS messages" ON sms_messages
  FOR SELECT USING (
    conversation_id IN (SELECT id FROM sms_conversations WHERE user_id = auth.uid())
  );

CREATE POLICY "Send SMS messages" ON sms_messages
  FOR INSERT WITH CHECK (
    conversation_id IN (SELECT id FROM sms_conversations WHERE user_id = auth.uid())
  );

CREATE POLICY "View SMS opt-out log" ON sms_opt_out_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Insert SMS opt-out log" ON sms_opt_out_log
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Manage own auto responders" ON sms_auto_responders
  FOR ALL USING (user_id = auth.uid());

-- ACTIVITY_LOG policies
CREATE POLICY "View all activity" ON activity_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Insert activity" ON activity_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- NOTIFICATION_PREFERENCES policies
CREATE POLICY "View own preferences" ON notification_preferences
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Manage own preferences" ON notification_preferences
  FOR ALL USING (user_id = auth.uid());

-- PROJECTS policies
CREATE POLICY "View projects" ON projects
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Create projects" ON projects
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Update projects" ON projects
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Delete own projects" ON projects
  FOR DELETE USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
  );

-- PROJECT_TASKS policies
CREATE POLICY "View project tasks" ON project_tasks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Manage project tasks" ON project_tasks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================================================
-- REALTIME SUBSCRIPTIONS
-- =====================================================
DO $$
BEGIN
  -- Add tables to realtime if not already there
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'chat_rooms') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_rooms;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'chat_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'chat_typing_indicators') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_typing_indicators;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'sms_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sms_messages;
  END IF;
END $$;

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'user_profiles', 'clients', 'client_contacts', 'chat_rooms', 'chat_messages',
      'email_connections', 'email_classifications', 'sms_settings', 'sms_conversations',
      'sms_auto_responders', 'notification_preferences', 'projects'
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
-- SEED DEFAULT DATA
-- =====================================================

-- Create default community chat rooms (using dynamic SQL)
DO $$
BEGIN
  EXECUTE '
    INSERT INTO chat_rooms (name, slug, description, type, is_private)
    VALUES
      (''General'', ''general'', ''General discussion for the team'', ''community'', false),
      (''Announcements'', ''announcements'', ''Important team announcements'', ''community'', false),
      (''Random'', ''random'', ''Off-topic chat and fun'', ''community'', false)
    ON CONFLICT (slug) DO NOTHING
  ';
END $$;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- This migration creates all foundation tables that were
-- previously missing or only existed in scripts:
--
-- - user_profiles (15 columns)
-- - clients (28 columns)
-- - client_contacts (13 columns)
-- - client_communications (13 columns)
-- - chat_rooms (14 columns)
-- - chat_messages (14 columns)
-- - chat_room_members (10 columns)
-- - chat_typing_indicators (4 columns)
-- - email_connections (18 columns)
-- - email_classifications (22 columns)
-- - sms_settings (12 columns)
-- - sms_conversations (12 columns)
-- - sms_messages (12 columns)
-- - sms_opt_out_log (5 columns)
-- - sms_auto_responders (8 columns)
-- - activity_log (10 columns)
-- - notification_preferences (21 columns)
-- - projects (17 columns)
-- - project_tasks (6 columns)
--
-- Total: 19 tables with full RLS policies and indexes
-- =====================================================
