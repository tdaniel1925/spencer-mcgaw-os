-- =====================================================
-- ADD CASCADE DELETES - Fix orphaned data on deletions
-- =====================================================
-- This migration safely adds CASCADE/SET NULL constraints
-- Only modifies constraints if tables and columns exist

-- Helper function to safely add foreign key constraints
DO $$
BEGIN
  -- TASKS table - client_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_client_id_fkey;
    ALTER TABLE tasks ADD CONSTRAINT tasks_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
  END IF;

  -- TASKS table - assigned_to (check both possible column names)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'assigned_to'
  ) THEN
    ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assigned_to_fkey;
    ALTER TABLE tasks ADD CONSTRAINT tasks_assigned_to_fkey
      FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'claimed_by'
  ) THEN
    ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_claimed_by_fkey;
    ALTER TABLE tasks ADD CONSTRAINT tasks_claimed_by_fkey
      FOREIGN KEY (claimed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  -- CALLS table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calls' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_client_id_fkey;
    ALTER TABLE calls ADD CONSTRAINT calls_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
  END IF;

  -- DOCUMENTS table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_client_id_fkey;
    ALTER TABLE documents ADD CONSTRAINT documents_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
  END IF;

  -- ACTIVITY_LOGS table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activity_logs' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_client_id_fkey;
    ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activity_logs' AND column_name = 'task_id'
  ) THEN
    ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_task_id_fkey;
    ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_task_id_fkey
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL;
  END IF;

  -- CALENDAR_EVENTS table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendar_events' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_client_id_fkey;
    ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
  END IF;

  -- CLIENT_CONTACTS table - CASCADE delete
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_contacts' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE client_contacts DROP CONSTRAINT IF EXISTS client_contacts_client_id_fkey;
    ALTER TABLE client_contacts ADD CONSTRAINT client_contacts_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
  END IF;

  -- CLIENT_SERVICES table - CASCADE delete
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_services' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE client_services DROP CONSTRAINT IF EXISTS client_services_client_id_fkey;
    ALTER TABLE client_services ADD CONSTRAINT client_services_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
  END IF;

  -- CLIENT_TAX_FILINGS table - CASCADE delete
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_tax_filings' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE client_tax_filings DROP CONSTRAINT IF EXISTS client_tax_filings_client_id_fkey;
    ALTER TABLE client_tax_filings ADD CONSTRAINT client_tax_filings_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
  END IF;

  -- CLIENT_DEADLINES table - CASCADE delete
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_deadlines' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE client_deadlines DROP CONSTRAINT IF EXISTS client_deadlines_client_id_fkey;
    ALTER TABLE client_deadlines ADD CONSTRAINT client_deadlines_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
  END IF;

  -- CLIENT_NOTES table - CASCADE delete
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_notes' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE client_notes DROP CONSTRAINT IF EXISTS client_notes_client_id_fkey;
    ALTER TABLE client_notes ADD CONSTRAINT client_notes_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
  END IF;

  -- PROJECT_TASKS table - CASCADE delete
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_tasks' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE project_tasks DROP CONSTRAINT IF EXISTS project_tasks_project_id_fkey;
    ALTER TABLE project_tasks ADD CONSTRAINT project_tasks_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  END IF;

  -- PROJECT_NOTES table - CASCADE delete
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_notes' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE project_notes DROP CONSTRAINT IF EXISTS project_notes_project_id_fkey;
    ALTER TABLE project_notes ADD CONSTRAINT project_notes_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
  END IF;

  -- TASK_ACTIVITY_LOG table - CASCADE delete
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_activity_log' AND column_name = 'task_id'
  ) THEN
    ALTER TABLE task_activity_log DROP CONSTRAINT IF EXISTS task_activity_log_task_id_fkey;
    ALTER TABLE task_activity_log ADD CONSTRAINT task_activity_log_task_id_fkey
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
  END IF;

  -- TASK_NOTES table - CASCADE delete
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_notes' AND column_name = 'task_id'
  ) THEN
    ALTER TABLE task_notes DROP CONSTRAINT IF EXISTS task_notes_task_id_fkey;
    ALTER TABLE task_notes ADD CONSTRAINT task_notes_task_id_fkey
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
  END IF;

  -- FILES table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'files' AND column_name = 'folder_id'
  ) THEN
    ALTER TABLE files DROP CONSTRAINT IF EXISTS files_folder_id_fkey;
    ALTER TABLE files ADD CONSTRAINT files_folder_id_fkey
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL;
  END IF;

  -- FILE_VERSIONS table - CASCADE delete
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'file_versions' AND column_name = 'file_id'
  ) THEN
    ALTER TABLE file_versions DROP CONSTRAINT IF EXISTS file_versions_file_id_fkey;
    ALTER TABLE file_versions ADD CONSTRAINT file_versions_file_id_fkey
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE;
  END IF;

  -- FILE_SHARES table - CASCADE delete
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'file_shares' AND column_name = 'file_id'
  ) THEN
    ALTER TABLE file_shares DROP CONSTRAINT IF EXISTS file_shares_file_id_fkey;
    ALTER TABLE file_shares ADD CONSTRAINT file_shares_file_id_fkey
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE;
  END IF;

  -- FILE_ACTIVITY table - CASCADE delete
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'file_activity' AND column_name = 'file_id'
  ) THEN
    ALTER TABLE file_activity DROP CONSTRAINT IF EXISTS file_activity_file_id_fkey;
    ALTER TABLE file_activity ADD CONSTRAINT file_activity_file_id_fkey
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE;
  END IF;

  -- FOLDER_PERMISSIONS table - CASCADE delete
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'folder_permissions' AND column_name = 'folder_id'
  ) THEN
    ALTER TABLE folder_permissions DROP CONSTRAINT IF EXISTS folder_permissions_folder_id_fkey;
    ALTER TABLE folder_permissions ADD CONSTRAINT folder_permissions_folder_id_fkey
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE;
  END IF;

END $$;

-- =====================================================
-- SUMMARY
-- =====================================================
-- This migration safely adds foreign key constraints with:
--
-- CASCADE DELETE for child tables:
-- - client_contacts, client_services, client_tax_filings,
--   client_deadlines, client_notes (when client deleted)
-- - project_tasks, project_notes (when project deleted)
-- - task_activity_log, task_notes (when task deleted)
-- - file_versions, file_shares, file_activity (when file deleted)
-- - folder_permissions (when folder deleted)
--
-- SET NULL on delete for references:
-- - tasks.client_id, tasks.assigned_to, tasks.claimed_by
-- - calls.client_id, documents.client_id
-- - activity_logs references
-- - calendar_events.client_id
-- - files.folder_id
-- =====================================================
