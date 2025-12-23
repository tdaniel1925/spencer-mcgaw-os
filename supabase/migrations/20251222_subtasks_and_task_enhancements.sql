-- Subtasks and Task Enhancements Migration
-- Adds subtasks table for breaking down tasks into checklist items
-- Enhances task activity tracking

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Subtasks Table (checklist items within a task)
CREATE TABLE IF NOT EXISTS subtasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    position INTEGER DEFAULT 0, -- For ordering subtasks
    due_date TIMESTAMPTZ, -- Optional due date for subtask
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for subtasks
CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_position ON subtasks(task_id, position);
CREATE INDEX IF NOT EXISTS idx_subtasks_completed ON subtasks(task_id, is_completed);

-- RLS Policies for subtasks
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view subtasks (tasks are org-wide)
CREATE POLICY "Authenticated users can view subtasks"
    ON subtasks FOR SELECT
    TO authenticated
    USING (true);

-- Authenticated users can create subtasks
CREATE POLICY "Authenticated users can create subtasks"
    ON subtasks FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Authenticated users can update subtasks
CREATE POLICY "Authenticated users can update subtasks"
    ON subtasks FOR UPDATE
    TO authenticated
    USING (true);

-- Authenticated users can delete subtasks
CREATE POLICY "Authenticated users can delete subtasks"
    ON subtasks FOR DELETE
    TO authenticated
    USING (true);

-- Trigger to update updated_at on subtasks
DROP TRIGGER IF EXISTS subtasks_updated_at ON subtasks;
CREATE TRIGGER subtasks_updated_at
    BEFORE UPDATE ON subtasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add task_activity table if it doesn't exist (unified activity feed for tasks)
CREATE TABLE IF NOT EXISTS task_activity (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- 'created', 'updated', 'completed', 'assigned', 'subtask_added', 'subtask_completed', 'comment', etc.
    description TEXT,
    old_value JSONB, -- Previous state for changes
    new_value JSONB, -- New state for changes
    metadata JSONB, -- Additional context
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for task_activity
CREATE INDEX IF NOT EXISTS idx_task_activity_task ON task_activity(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_user ON task_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_created ON task_activity(created_at DESC);

-- RLS Policies for task_activity
ALTER TABLE task_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view task activity"
    ON task_activity FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can create task activity"
    ON task_activity FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Add source_call_id to tasks if not exists (for linking tasks to phone calls)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'tasks' AND column_name = 'source_call_id') THEN
        ALTER TABLE tasks ADD COLUMN source_call_id UUID REFERENCES calls(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add source_email_classification_id to tasks if not exists (for linking tasks to email classifications)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'tasks' AND column_name = 'source_email_classification_id') THEN
        ALTER TABLE tasks ADD COLUMN source_email_classification_id UUID;
    END IF;
END $$;

-- Add comments
COMMENT ON TABLE subtasks IS 'Checklist items that break down a task into smaller actionable steps';
COMMENT ON COLUMN subtasks.position IS 'Order of subtask within the task (0-indexed)';
COMMENT ON TABLE task_activity IS 'Activity feed for tasks showing all changes and actions';
COMMENT ON COLUMN task_activity.action IS 'The type of action: created, updated, completed, assigned, subtask_added, subtask_completed, comment, etc.';
