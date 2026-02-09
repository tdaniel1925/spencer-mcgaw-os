-- Migration: Add missing tables to database
-- Missing: task_handoff_history, task_pools, task_recurrence,
--          email_threads, email_messages, email_attachments,
--          email_sync_state, email_ai_insights

-- Create missing enums first
DO $$ BEGIN
  CREATE TYPE email_category AS ENUM('primary', 'work', 'personal', 'promotional', 'updates', 'forums', 'social', 'spam');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE email_folder AS ENUM('inbox', 'sent', 'drafts', 'archive', 'trash');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE email_importance AS ENUM('low', 'normal', 'high');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE email_intent AS ENUM('question', 'request', 'fyi', 'urgent', 'meeting_invite');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE email_provider AS ENUM('microsoft', 'google', 'imap');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE email_sentiment AS ENUM('positive', 'neutral', 'negative', 'urgent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE folder_type AS ENUM('personal', 'team', 'repository', 'client');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE permission AS ENUM('view', 'edit', 'admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE share_permission AS ENUM('view', 'download', 'edit');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE share_type AS ENUM('link', 'email', 'internal');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE sync_status AS ENUM('idle', 'syncing', 'error', 'paused');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE webhook_sub_status AS ENUM('active', 'expired', 'failed', 'none');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 1. task_handoff_history
CREATE TABLE IF NOT EXISTS task_handoff_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  from_user_id uuid REFERENCES users(id),
  to_user_id uuid REFERENCES users(id),
  reason text,
  notes text,
  handoff_type text DEFAULT 'reassign',
  created_at timestamp DEFAULT now() NOT NULL
);

-- 2. task_pools
CREATE TABLE IF NOT EXISTS task_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  description text,
  slug text NOT NULL UNIQUE,
  auto_assign_enabled boolean NOT NULL DEFAULT false,
  round_robin_enabled boolean NOT NULL DEFAULT false,
  max_tasks_per_user integer,
  eligible_user_ids jsonb DEFAULT '[]'::jsonb,
  eligible_roles jsonb DEFAULT '[]'::jsonb,
  eligible_departments jsonb DEFAULT '[]'::jsonb,
  action_type_ids jsonb DEFAULT '[]'::jsonb,
  priority_filter jsonb DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id),
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

-- 3. task_recurrence
CREATE TABLE IF NOT EXISTS task_recurrence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  description text,
  action_type_id uuid REFERENCES task_action_types(id),
  client_id uuid REFERENCES clients(id),
  priority text DEFAULT 'medium',
  estimated_minutes integer,
  tags jsonb DEFAULT '[]'::jsonb,
  frequency text NOT NULL,
  interval_value integer NOT NULL DEFAULT 1,
  day_of_week jsonb,
  day_of_month jsonb,
  month_of_year jsonb,
  start_date timestamp NOT NULL,
  end_date timestamp,
  due_time timestamp,
  lead_days integer DEFAULT 0,
  assign_to uuid REFERENCES users(id),
  pool_id uuid REFERENCES task_pools(id),
  is_active boolean NOT NULL DEFAULT true,
  last_generated_at timestamp,
  next_occurrence timestamp,
  created_by uuid REFERENCES users(id),
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

-- 4. email_threads
CREATE TABLE IF NOT EXISTS email_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id varchar(500),
  subject text NOT NULL,
  participants jsonb NOT NULL DEFAULT '[]'::jsonb,
  participant_names jsonb DEFAULT '[]'::jsonb,
  message_count integer NOT NULL DEFAULT 0,
  unread_count integer NOT NULL DEFAULT 0,
  has_attachments boolean NOT NULL DEFAULT false,
  first_message_at timestamp,
  last_message_at timestamp,
  last_activity_at timestamp,
  category email_category,
  priority_score integer DEFAULT 50,
  is_archived boolean NOT NULL DEFAULT false,
  is_muted boolean NOT NULL DEFAULT false,
  labels jsonb DEFAULT '[]'::jsonb,
  client_id uuid REFERENCES clients(id),
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

-- 5. email_messages
CREATE TABLE IF NOT EXISTS email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES email_connections(id) ON DELETE CASCADE,
  thread_id uuid REFERENCES email_threads(id) ON DELETE CASCADE,
  message_id varchar(500) NOT NULL UNIQUE,
  conversation_id varchar(500),
  internet_message_id varchar(500),
  subject text,
  from_email varchar(255),
  from_name varchar(255),
  to_recipients jsonb DEFAULT '[]'::jsonb,
  cc_recipients jsonb DEFAULT '[]'::jsonb,
  bcc_recipients jsonb DEFAULT '[]'::jsonb,
  body_preview varchar(500),
  body_html text,
  body_text text,
  received_at timestamp,
  sent_at timestamp,
  importance email_importance DEFAULT 'normal',
  is_read boolean NOT NULL DEFAULT false,
  is_flagged boolean NOT NULL DEFAULT false,
  is_draft boolean NOT NULL DEFAULT false,
  has_attachments boolean NOT NULL DEFAULT false,
  attachment_count integer DEFAULT 0,
  category email_category,
  priority_score integer DEFAULT 50,
  labels jsonb DEFAULT '[]'::jsonb,
  is_archived boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamp,
  folder email_folder DEFAULT 'inbox',
  ai_summary text,
  ai_suggested_actions jsonb,
  ai_detected_intent email_intent,
  ai_sentiment email_sentiment,
  client_id uuid REFERENCES clients(id),
  related_task_ids jsonb DEFAULT '[]'::jsonb,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

-- 6. email_attachments
CREATE TABLE IF NOT EXISTS email_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  message_id uuid NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attachment_id varchar(255),
  name varchar(500) NOT NULL,
  content_type varchar(100),
  size_bytes integer,
  is_inline boolean DEFAULT false,
  content_id varchar(255),
  storage_path varchar(1000),
  storage_bucket varchar(100) DEFAULT 'email-attachments',
  download_url text,
  download_url_expires_at timestamp,
  file_id uuid REFERENCES files(id),
  created_at timestamp DEFAULT now() NOT NULL
);

-- 7. email_sync_state
CREATE TABLE IF NOT EXISTS email_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  connection_id uuid NOT NULL UNIQUE REFERENCES email_connections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_sync_at timestamp,
  last_successful_sync_at timestamp,
  next_sync_scheduled_at timestamp,
  sync_status sync_status DEFAULT 'idle',
  sync_error text,
  sync_error_count integer DEFAULT 0,
  delta_token text,
  sync_cursor varchar(500),
  webhook_subscription_id varchar(255),
  webhook_expires_at timestamp,
  webhook_status webhook_sub_status DEFAULT 'none',
  webhook_notification_url text,
  total_messages_synced integer DEFAULT 0,
  last_message_count integer DEFAULT 0,
  sync_duration_ms integer,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

-- 8. email_ai_insights
CREATE TABLE IF NOT EXISTS email_ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  message_id uuid NOT NULL UNIQUE REFERENCES email_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category email_category,
  priority_score integer,
  summary text,
  detected_intent email_intent,
  sentiment email_sentiment,
  suggested_actions jsonb,
  keywords jsonb,
  entities jsonb,
  suggested_tasks jsonb,
  task_confidence integer,
  suggested_client_id uuid REFERENCES clients(id),
  client_match_confidence integer,
  client_match_reasoning text,
  model_used varchar(50) DEFAULT 'gpt-4o',
  processing_cost_millicents integer,
  processing_time_ms integer,
  processed_at timestamp DEFAULT now() NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_task_handoff_task ON task_handoff_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_handoff_from_user ON task_handoff_history(from_user_id);
CREATE INDEX IF NOT EXISTS idx_task_handoff_to_user ON task_handoff_history(to_user_id);

CREATE INDEX IF NOT EXISTS idx_task_recurrence_client ON task_recurrence(client_id);
CREATE INDEX IF NOT EXISTS idx_task_recurrence_next ON task_recurrence(next_occurrence);
CREATE INDEX IF NOT EXISTS idx_task_recurrence_active ON task_recurrence(is_active);

CREATE INDEX IF NOT EXISTS idx_email_threads_user ON email_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_client ON email_threads(client_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_last_message ON email_threads(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_messages_user ON email_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_thread ON email_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_connection ON email_messages(connection_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_received ON email_messages(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_folder ON email_messages(folder);
CREATE INDEX IF NOT EXISTS idx_email_messages_is_read ON email_messages(is_read);

CREATE INDEX IF NOT EXISTS idx_email_attachments_message ON email_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_email_attachments_user ON email_attachments(user_id);

CREATE INDEX IF NOT EXISTS idx_email_sync_connection ON email_sync_state(connection_id);
CREATE INDEX IF NOT EXISTS idx_email_sync_user ON email_sync_state(user_id);

CREATE INDEX IF NOT EXISTS idx_email_ai_insights_message ON email_ai_insights(message_id);
CREATE INDEX IF NOT EXISTS idx_email_ai_insights_user ON email_ai_insights(user_id);
