-- Add metadata column to email_connections table if it doesn't exist
ALTER TABLE email_connections
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add comment
COMMENT ON COLUMN email_connections.metadata IS 'Additional provider-specific metadata (IMAP host, port, etc)';
