-- Reset All Data Except Users
-- WARNING: This will delete ALL data except user accounts
-- Run this only if you're sure you want to clear everything

BEGIN;

-- Disable foreign key checks temporarily (for PostgreSQL, we'll delete in dependency order)

-- Delete potential tasks (AI suggestions)
DELETE FROM potential_tasks;

-- Delete tasks and related
DELETE FROM task_assignments;
DELETE FROM task_comments;
DELETE FROM tasks;

-- Delete calls and related
DELETE FROM call_summaries;
DELETE FROM calls;

-- Delete email related
DELETE FROM email_action_items;
DELETE FROM email_classifications;
DELETE FROM email_accounts;

-- Delete projects
DELETE FROM project_members;
DELETE FROM projects;

-- Delete clients (this will cascade to related records)
DELETE FROM client_notes;
DELETE FROM clients;

-- Delete activities/events
DELETE FROM activities;
DELETE FROM audit_logs;

-- Delete files and folders
DELETE FROM file_shares;
DELETE FROM file_versions;
DELETE FROM file_activity;
DELETE FROM files;
DELETE FROM folder_permissions;
DELETE FROM folders;

-- Delete webhooks
DELETE FROM webhook_logs;

-- Delete notifications
DELETE FROM notifications;

-- Delete chat messages
DELETE FROM chat_messages;
DELETE FROM chat_channels;

-- Delete any other activity logs
DELETE FROM user_activity;

-- Reset any sequences/counters (if needed)
-- ALTER SEQUENCE clients_client_number_seq RESTART WITH 1;

COMMIT;

-- Verify what's left (should only be users and organizations)
SELECT
  'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'organizations', COUNT(*) FROM organizations
UNION ALL
SELECT 'clients', COUNT(*) FROM clients
UNION ALL
SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL
SELECT 'calls', COUNT(*) FROM calls
UNION ALL
SELECT 'potential_tasks', COUNT(*) FROM potential_tasks
UNION ALL
SELECT 'email_classifications', COUNT(*) FROM email_classifications
UNION ALL
SELECT 'activities', COUNT(*) FROM activities;
