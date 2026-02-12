-- Add is_global column to email_connections table
-- This determines if emails go to "Personal Inbox" (false) or "Org Feed" (true)

ALTER TABLE email_connections
ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN email_connections.is_global IS 'true = Org Feed (visible to all users), false = Personal Inbox (private to user)';

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_email_connections_is_global ON email_connections(is_global);
