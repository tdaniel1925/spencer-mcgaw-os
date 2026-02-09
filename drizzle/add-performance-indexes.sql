-- =====================================================================
-- PERFORMANCE INDEXES FOR PRODUCTION DEPLOYMENT
-- =====================================================================
-- This migration adds critical indexes to improve query performance
-- Run this before deploying to production or when data volume increases
-- Estimated time: 2-5 minutes on moderate data sets
-- =====================================================================

-- =====================================================================
-- TASKS TABLE INDEXES (Most Critical - Highest Query Volume)
-- =====================================================================

-- Index for filtering by status (WHERE status = 'open')
CREATE INDEX IF NOT EXISTS idx_tasks_status
ON tasks(status)
WHERE status != 'cancelled';

-- Index for finding assigned tasks (WHERE assigned_to = user_id)
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to
ON tasks(assigned_to)
WHERE assigned_to IS NOT NULL;

-- Index for client tasks (WHERE client_id = ?)
CREATE INDEX IF NOT EXISTS idx_tasks_client_id
ON tasks(client_id)
WHERE client_id IS NOT NULL;

-- Index for upcoming due tasks (WHERE due_date > NOW() ORDER BY due_date)
CREATE INDEX IF NOT EXISTS idx_tasks_due_date
ON tasks(due_date)
WHERE due_date IS NOT NULL AND status NOT IN ('completed', 'cancelled');

-- Index for recent tasks (ORDER BY created_at DESC)
CREATE INDEX IF NOT EXISTS idx_tasks_created_at
ON tasks(created_at DESC);

-- Index for organization multi-tenancy
CREATE INDEX IF NOT EXISTS idx_tasks_organization_id
ON tasks(organization_id);

-- Composite index for common query pattern (status + assigned user)
CREATE INDEX IF NOT EXISTS idx_tasks_status_assigned
ON tasks(status, assigned_to)
WHERE assigned_to IS NOT NULL;

-- Composite index for client task filtering (client + status)
CREATE INDEX IF NOT EXISTS idx_tasks_client_status
ON tasks(client_id, status)
WHERE client_id IS NOT NULL;

-- Index for action type filtering
CREATE INDEX IF NOT EXISTS idx_tasks_action_type
ON tasks(action_type_id)
WHERE action_type_id IS NOT NULL;

-- Index for claimed tasks
CREATE INDEX IF NOT EXISTS idx_tasks_claimed_by
ON tasks(claimed_by)
WHERE claimed_by IS NOT NULL;

-- =====================================================================
-- CLIENTS TABLE INDEXES
-- =====================================================================

-- Index for client search by name
CREATE INDEX IF NOT EXISTS idx_clients_name
ON clients(first_name, last_name);

-- Index for email lookup
CREATE INDEX IF NOT EXISTS idx_clients_email
ON clients(email)
WHERE email IS NOT NULL;

-- Index for phone lookup
CREATE INDEX IF NOT EXISTS idx_clients_phone
ON clients(phone)
WHERE phone IS NOT NULL;

-- Index for assigned user filtering
CREATE INDEX IF NOT EXISTS idx_clients_assigned_user
ON clients(assigned_user_id)
WHERE assigned_user_id IS NOT NULL;

-- Index for active clients
CREATE INDEX IF NOT EXISTS idx_clients_active
ON clients(is_active)
WHERE is_active = true;

-- Index for recent clients
CREATE INDEX IF NOT EXISTS idx_clients_created_at
ON clients(created_at DESC);

-- =====================================================================
-- EMAILS TABLE INDEXES
-- =====================================================================

-- Index for client emails
CREATE INDEX IF NOT EXISTS idx_emails_client_id
ON emails(client_id)
WHERE client_id IS NOT NULL;

-- Index for email account filtering
CREATE INDEX IF NOT EXISTS idx_emails_account_id
ON emails(email_account_id);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_emails_category
ON emails(category);

-- Index for inbox queries (received_at DESC)
CREATE INDEX IF NOT EXISTS idx_emails_received_at
ON emails(received_at DESC);

-- Index for unread emails
CREATE INDEX IF NOT EXISTS idx_emails_is_read
ON emails(is_read)
WHERE is_read = false;

-- Index for email folder filtering
CREATE INDEX IF NOT EXISTS idx_emails_folder
ON emails(folder);

-- Composite index for account + folder queries
CREATE INDEX IF NOT EXISTS idx_emails_account_folder
ON emails(email_account_id, folder, received_at DESC);

-- Index for from email address (sender lookup)
CREATE INDEX IF NOT EXISTS idx_emails_from_email
ON emails(from_email);

-- =====================================================================
-- CALLS TABLE INDEXES
-- =====================================================================

-- Index for client calls
CREATE INDEX IF NOT EXISTS idx_calls_client_id
ON calls(client_id)
WHERE client_id IS NOT NULL;

-- Index for call status filtering
CREATE INDEX IF NOT EXISTS idx_calls_status
ON calls(status);

-- Index for recent calls (called_at DESC)
CREATE INDEX IF NOT EXISTS idx_calls_called_at
ON calls(called_at DESC);

-- Index for call direction
CREATE INDEX IF NOT EXISTS idx_calls_direction
ON calls(direction);

-- Index for phone number lookup
CREATE INDEX IF NOT EXISTS idx_calls_caller_phone
ON calls(caller_phone);

-- Index for GoTo Connect call ID
CREATE INDEX IF NOT EXISTS idx_calls_goto_call_id
ON calls(goto_call_id)
WHERE goto_call_id IS NOT NULL;

-- =====================================================================
-- SMS MESSAGES TABLE INDEXES
-- =====================================================================

-- Index for conversation filtering
CREATE INDEX IF NOT EXISTS idx_sms_conversation_id
ON sms_messages(conversation_id);

-- Index for client messages
CREATE INDEX IF NOT EXISTS idx_sms_client_id
ON sms_messages(client_id)
WHERE client_id IS NOT NULL;

-- Index for recent messages
CREATE INDEX IF NOT EXISTS idx_sms_sent_at
ON sms_messages(sent_at DESC);

-- Index for direction filtering
CREATE INDEX IF NOT EXISTS idx_sms_direction
ON sms_messages(direction);

-- Index for phone number lookup
CREATE INDEX IF NOT EXISTS idx_sms_to_number
ON sms_messages(to_number);

-- Index for message status
CREATE INDEX IF NOT EXISTS idx_sms_status
ON sms_messages(status);

-- =====================================================================
-- ACTIVITY LOG TABLE INDEXES
-- =====================================================================

-- Index for user activity (WHERE user_id = ?)
CREATE INDEX IF NOT EXISTS idx_activity_user_id
ON activity_log(user_id);

-- Index for resource lookup (WHERE resource_type = ? AND resource_id = ?)
CREATE INDEX IF NOT EXISTS idx_activity_resource
ON activity_log(resource_type, resource_id);

-- Index for recent activity
CREATE INDEX IF NOT EXISTS idx_activity_created_at
ON activity_log(created_at DESC);

-- Composite index for user recent activity
CREATE INDEX IF NOT EXISTS idx_activity_user_created
ON activity_log(user_id, created_at DESC);

-- =====================================================================
-- FILES TABLE INDEXES
-- =====================================================================

-- Index for client files
CREATE INDEX IF NOT EXISTS idx_files_client_id
ON files(client_id)
WHERE client_id IS NOT NULL;

-- Index for folder contents
CREATE INDEX IF NOT EXISTS idx_files_folder_id
ON files(folder_id)
WHERE folder_id IS NOT NULL;

-- Index for recent files
CREATE INDEX IF NOT EXISTS idx_files_uploaded_at
ON files(uploaded_at DESC);

-- Index for active (non-deleted) files
CREATE INDEX IF NOT EXISTS idx_files_is_deleted
ON files(is_deleted)
WHERE is_deleted = false;

-- Index for file uploader
CREATE INDEX IF NOT EXISTS idx_files_uploaded_by
ON files(uploaded_by);

-- Index for file type filtering
CREATE INDEX IF NOT EXISTS idx_files_file_type
ON files(file_type);

-- =====================================================================
-- FOLDERS TABLE INDEXES
-- =====================================================================

-- Index for folder type
CREATE INDEX IF NOT EXISTS idx_folders_type
ON folders(folder_type);

-- Index for client folders
CREATE INDEX IF NOT EXISTS idx_folders_client_id
ON folders(client_id)
WHERE client_id IS NOT NULL;

-- Index for folder owner
CREATE INDEX IF NOT EXISTS idx_folders_owner_id
ON folders(owner_id);

-- =====================================================================
-- TASK SUBTABLES INDEXES
-- =====================================================================

-- Task steps by task
CREATE INDEX IF NOT EXISTS idx_task_steps_task_id
ON task_steps(task_id);

-- Task notes by task
CREATE INDEX IF NOT EXISTS idx_task_notes_task_id
ON task_notes(task_id);

-- Task activity by task
CREATE INDEX IF NOT EXISTS idx_task_activity_task_id
ON task_activity(task_id);

-- Task activity log by task
CREATE INDEX IF NOT EXISTS idx_task_activity_log_task_id
ON task_activity_log(task_id);

-- =====================================================================
-- CALENDAR EVENTS TABLE INDEXES
-- =====================================================================

-- Index for event date range queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_start
ON calendar_events(start_time);

CREATE INDEX IF NOT EXISTS idx_calendar_events_end
ON calendar_events(end_time);

-- Index for user events
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id
ON calendar_events(user_id);

-- Index for client events
CREATE INDEX IF NOT EXISTS idx_calendar_events_client_id
ON calendar_events(client_id)
WHERE client_id IS NOT NULL;

-- Index for calendar connection
CREATE INDEX IF NOT EXISTS idx_calendar_events_connection_id
ON calendar_events(calendar_connection_id)
WHERE calendar_connection_id IS NOT NULL;

-- =====================================================================
-- USERS TABLE INDEXES
-- =====================================================================

-- Index for email lookup (authentication)
CREATE INDEX IF NOT EXISTS idx_users_email
ON users(email);

-- Index for active users
CREATE INDEX IF NOT EXISTS idx_users_is_active
ON users(is_active)
WHERE is_active = true;

-- Index for user role filtering
CREATE INDEX IF NOT EXISTS idx_users_role
ON users(role);

-- =====================================================================
-- NOTIFICATIONS TABLE INDEXES
-- =====================================================================

-- Index for user notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id
ON notifications(user_id);

-- Index for unread notifications
CREATE INDEX IF NOT EXISTS idx_notifications_is_read
ON notifications(is_read)
WHERE is_read = false;

-- Index for recent notifications
CREATE INDEX IF NOT EXISTS idx_notifications_created_at
ON notifications(created_at DESC);

-- Composite index for user unread notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
ON notifications(user_id, is_read, created_at DESC)
WHERE is_read = false;

-- =====================================================================
-- END OF INDEXES
-- =====================================================================

-- Analyze tables to update statistics for query planner
ANALYZE tasks;
ANALYZE clients;
ANALYZE emails;
ANALYZE calls;
ANALYZE sms_messages;
ANALYZE activity_log;
ANALYZE files;
ANALYZE users;

-- =====================================================================
-- VERIFICATION QUERIES
-- =====================================================================
-- Run these to verify indexes were created successfully

-- List all indexes on tasks table
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'tasks';

-- Check index usage statistics (run after some production usage)
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
-- ORDER BY idx_scan DESC;

-- Find unused indexes (run after 1 week of production)
-- SELECT schemaname, tablename, indexname
-- FROM pg_stat_user_indexes
-- WHERE idx_scan = 0
-- AND indexname NOT LIKE '%_pkey'
-- AND schemaname = 'public';
