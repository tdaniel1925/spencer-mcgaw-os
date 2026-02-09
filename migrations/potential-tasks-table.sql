-- Create potential_task_status enum
CREATE TYPE potential_task_status AS ENUM ('pending', 'approved', 'dismissed', 'expired');

-- Create potential_tasks table
CREATE TABLE IF NOT EXISTS potential_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Email source
  source_email_from VARCHAR(255) NOT NULL,
  source_email_subject TEXT,
  source_email_body TEXT,
  source_email_received_at TIMESTAMP NOT NULL,
  email_message_id UUID REFERENCES email_messages(id) ON DELETE SET NULL,

  -- AI-suggested task details
  suggested_title TEXT NOT NULL,
  suggested_description TEXT,
  suggested_action_type_id UUID REFERENCES task_action_types(id),
  suggested_client_id UUID REFERENCES clients(id),
  suggested_assigned_to UUID REFERENCES users(id),
  suggested_due_date TIMESTAMP,
  suggested_priority TEXT DEFAULT 'medium',

  -- AI metadata
  ai_confidence INTEGER NOT NULL,
  ai_reasoning TEXT,
  ai_extracted_data JSONB DEFAULT '{}',

  -- Status and resolution
  status potential_task_status NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMP,
  reviewed_by UUID REFERENCES users(id),
  dismissal_reason TEXT,

  -- If approved, link to created task
  created_task_id UUID REFERENCES tasks(id),

  -- Auto-expire after 7 days
  expires_at TIMESTAMP NOT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_potential_tasks_user_id ON potential_tasks(user_id);
CREATE INDEX idx_potential_tasks_status ON potential_tasks(status);
CREATE INDEX idx_potential_tasks_expires_at ON potential_tasks(expires_at);
CREATE INDEX idx_potential_tasks_created_at ON potential_tasks(created_at);
