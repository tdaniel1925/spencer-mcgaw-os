-- Add first_viewed_at column to tasks table for tracking when a user first views a task
-- This enables notification badges for unopened tasks

-- Add column to tasks table
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS first_viewed_at TIMESTAMP WITH TIME ZONE;

-- Add index for efficient querying of unopened tasks
CREATE INDEX IF NOT EXISTS idx_tasks_unopened
ON tasks (assigned_to, first_viewed_at)
WHERE first_viewed_at IS NULL AND status != 'completed';

-- Add comment
COMMENT ON COLUMN tasks.first_viewed_at IS 'Timestamp when the task was first viewed by the assigned user. Used for unopened task notifications.';
