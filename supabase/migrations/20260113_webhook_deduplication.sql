-- Add event_id column to webhook_logs for persistent deduplication
-- This replaces the in-memory Set that was lost on server restarts

-- Add the event_id column
ALTER TABLE webhook_logs ADD COLUMN IF NOT EXISTS event_id VARCHAR(255);

-- Create an index on event_id for fast duplicate checks
-- Using a partial index for non-null values since old records won't have event_id
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_id ON webhook_logs(event_id) WHERE event_id IS NOT NULL;

-- Add a unique constraint on event_id (allowing nulls for old records)
-- This prevents duplicate processing even in race conditions
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_logs_event_id_unique ON webhook_logs(event_id) WHERE event_id IS NOT NULL;

-- Optional: Clean up old webhook logs after 30 days to prevent table bloat
-- This can be done via a scheduled job or cron:
-- DELETE FROM webhook_logs WHERE created_at < NOW() - INTERVAL '30 days';

COMMENT ON COLUMN webhook_logs.event_id IS 'Unique identifier for webhook event, used for deduplication across server restarts';
