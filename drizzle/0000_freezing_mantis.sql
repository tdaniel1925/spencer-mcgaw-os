CREATE TYPE "public"."activity_type" AS ENUM('call_received', 'call_made', 'email_received', 'email_sent', 'document_received', 'document_sent', 'task_created', 'task_completed', 'client_created', 'client_updated', 'note_added', 'form_submission', 'webhook_received');--> statement-breakpoint
CREATE TYPE "public"."call_status" AS ENUM('completed', 'missed', 'voicemail', 'transferred');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('received', 'processing', 'filed', 'needs_review');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('tax_return', 'w2', '1099', 'k1', 'bank_statement', 'credit_card_statement', 'receipt', 'invoice', 'payroll', 'irs_notice', 'other');--> statement-breakpoint
CREATE TYPE "public"."email_category" AS ENUM('primary', 'work', 'personal', 'promotional', 'updates', 'forums', 'social', 'spam');--> statement-breakpoint
CREATE TYPE "public"."email_folder" AS ENUM('inbox', 'sent', 'drafts', 'archive', 'trash');--> statement-breakpoint
CREATE TYPE "public"."email_importance" AS ENUM('low', 'normal', 'high');--> statement-breakpoint
CREATE TYPE "public"."email_intent" AS ENUM('question', 'request', 'fyi', 'urgent', 'meeting_invite');--> statement-breakpoint
CREATE TYPE "public"."email_provider" AS ENUM('microsoft', 'google', 'imap');--> statement-breakpoint
CREATE TYPE "public"."email_sentiment" AS ENUM('positive', 'neutral', 'negative', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."folder_type" AS ENUM('personal', 'team', 'repository', 'client');--> statement-breakpoint
CREATE TYPE "public"."permission" AS ENUM('view', 'edit', 'admin');--> statement-breakpoint
CREATE TYPE "public"."share_permission" AS ENUM('view', 'download', 'edit');--> statement-breakpoint
CREATE TYPE "public"."share_type" AS ENUM('link', 'email', 'internal');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('idle', 'syncing', 'error', 'paused');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'manager', 'staff');--> statement-breakpoint
CREATE TYPE "public"."webhook_status" AS ENUM('received', 'parsing', 'parsed', 'stored', 'failed');--> statement-breakpoint
CREATE TYPE "public"."webhook_sub_status" AS ENUM('active', 'expired', 'failed', 'none');--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "activity_type" NOT NULL,
	"description" text NOT NULL,
	"user_id" uuid,
	"client_id" uuid,
	"task_id" uuid,
	"call_id" uuid,
	"document_id" uuid,
	"metadata" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_training_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feedback_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"original_value" text,
	"suggested_value" text,
	"accepted" boolean NOT NULL,
	"user_value" text,
	"user_reason" text,
	"confidence_score" integer,
	"context" jsonb DEFAULT '{}'::jsonb,
	"user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"all_day" boolean DEFAULT false,
	"location" varchar(255),
	"client_id" uuid,
	"created_by_id" uuid,
	"assigned_to_id" uuid,
	"color" varchar(20),
	"is_recurring" boolean DEFAULT false,
	"recurrence_rule" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vapi_call_id" varchar(255),
	"client_id" uuid,
	"caller_phone" varchar(20),
	"caller_name" varchar(255),
	"status" "call_status" NOT NULL,
	"direction" varchar(20) DEFAULT 'inbound' NOT NULL,
	"duration" integer,
	"transcription" text,
	"summary" text,
	"intent" varchar(100),
	"sentiment" varchar(50),
	"was_transferred" boolean DEFAULT false,
	"transferred_to_id" uuid,
	"recording_url" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "calls_vapi_call_id_unique" UNIQUE("vapi_call_id")
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_number" varchar(20),
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"email" varchar(255),
	"phone" varchar(20),
	"alternate_phone" varchar(20),
	"address" text,
	"city" varchar(100),
	"state" varchar(50),
	"zip_code" varchar(20),
	"company_name" varchar(255),
	"tax_id" varchar(20),
	"service_types" jsonb,
	"assigned_user_id" uuid,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "clients_client_number_unique" UNIQUE("client_number")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid,
	"type" "document_type" NOT NULL,
	"status" "document_status" DEFAULT 'received' NOT NULL,
	"file_name" varchar(500) NOT NULL,
	"file_path" text,
	"file_size" integer,
	"mime_type" varchar(100),
	"source_channel" varchar(50),
	"source_email" varchar(255),
	"tax_year" integer,
	"extracted_data" jsonb,
	"processed_by_id" uuid,
	"processed_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_ai_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"category" "email_category",
	"priority_score" integer,
	"summary" text,
	"detected_intent" "email_intent",
	"sentiment" "email_sentiment",
	"suggested_actions" jsonb,
	"keywords" jsonb,
	"entities" jsonb,
	"suggested_tasks" jsonb,
	"task_confidence" integer,
	"suggested_client_id" uuid,
	"client_match_confidence" integer,
	"client_match_reasoning" text,
	"model_used" varchar(50) DEFAULT 'gpt-4o',
	"processing_cost_millicents" integer,
	"processing_time_ms" integer,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_ai_insights_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
CREATE TABLE "email_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"attachment_id" varchar(255),
	"name" varchar(500) NOT NULL,
	"content_type" varchar(100),
	"size_bytes" integer,
	"is_inline" boolean DEFAULT false,
	"content_id" varchar(255),
	"storage_path" varchar(1000),
	"storage_bucket" varchar(100) DEFAULT 'email-attachments',
	"download_url" text,
	"download_url_expires_at" timestamp,
	"file_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "email_provider" NOT NULL,
	"email" varchar(255) NOT NULL,
	"display_name" varchar(255),
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" timestamp,
	"scopes" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_sync_at" timestamp,
	"sync_errors" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"thread_id" uuid,
	"message_id" varchar(500) NOT NULL,
	"conversation_id" varchar(500),
	"internet_message_id" varchar(500),
	"subject" text,
	"from_email" varchar(255),
	"from_name" varchar(255),
	"to_recipients" jsonb DEFAULT '[]'::jsonb,
	"cc_recipients" jsonb DEFAULT '[]'::jsonb,
	"bcc_recipients" jsonb DEFAULT '[]'::jsonb,
	"body_preview" varchar(500),
	"body_html" text,
	"body_text" text,
	"received_at" timestamp,
	"sent_at" timestamp,
	"importance" "email_importance" DEFAULT 'normal',
	"is_read" boolean DEFAULT false NOT NULL,
	"is_flagged" boolean DEFAULT false NOT NULL,
	"is_draft" boolean DEFAULT false NOT NULL,
	"has_attachments" boolean DEFAULT false NOT NULL,
	"attachment_count" integer DEFAULT 0,
	"category" "email_category",
	"priority_score" integer DEFAULT 50,
	"labels" jsonb DEFAULT '[]'::jsonb,
	"is_archived" boolean DEFAULT false NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"folder" "email_folder" DEFAULT 'inbox',
	"ai_summary" text,
	"ai_suggested_actions" jsonb,
	"ai_detected_intent" "email_intent",
	"ai_sentiment" "email_sentiment",
	"client_id" uuid,
	"related_task_ids" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_messages_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
CREATE TABLE "email_sync_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"last_sync_at" timestamp,
	"last_successful_sync_at" timestamp,
	"next_sync_scheduled_at" timestamp,
	"sync_status" "sync_status" DEFAULT 'idle',
	"sync_error" text,
	"sync_error_count" integer DEFAULT 0,
	"delta_token" text,
	"sync_cursor" varchar(500),
	"webhook_subscription_id" varchar(255),
	"webhook_expires_at" timestamp,
	"webhook_status" "webhook_sub_status" DEFAULT 'none',
	"webhook_notification_url" text,
	"total_messages_synced" integer DEFAULT 0,
	"last_message_count" integer DEFAULT 0,
	"sync_duration_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_sync_state_connection_id_unique" UNIQUE("connection_id")
);
--> statement-breakpoint
CREATE TABLE "email_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"conversation_id" varchar(500),
	"subject" text NOT NULL,
	"participants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"participant_names" jsonb DEFAULT '[]'::jsonb,
	"message_count" integer DEFAULT 0 NOT NULL,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"has_attachments" boolean DEFAULT false NOT NULL,
	"first_message_at" timestamp,
	"last_message_at" timestamp,
	"last_activity_at" timestamp,
	"category" "email_category",
	"priority_score" integer DEFAULT 50,
	"is_archived" boolean DEFAULT false NOT NULL,
	"is_muted" boolean DEFAULT false NOT NULL,
	"labels" jsonb DEFAULT '[]'::jsonb,
	"client_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid,
	"folder_id" uuid,
	"user_id" uuid,
	"action" varchar(100) NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid,
	"folder_id" uuid,
	"share_token" varchar(255) NOT NULL,
	"share_type" "share_type" DEFAULT 'link' NOT NULL,
	"permission" "share_permission" DEFAULT 'view' NOT NULL,
	"password_hash" text,
	"max_downloads" integer,
	"download_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_accessed_at" timestamp,
	"recipient_email" varchar(255),
	"message" text,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "file_shares_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "file_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"storage_path" text NOT NULL,
	"storage_bucket" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"checksum" varchar(64),
	"change_summary" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(500) NOT NULL,
	"original_name" varchar(500) NOT NULL,
	"description" text,
	"folder_id" uuid,
	"owner_id" uuid,
	"storage_path" text NOT NULL,
	"storage_bucket" varchar(100) DEFAULT 'files' NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"file_extension" varchar(20),
	"checksum" varchar(64),
	"is_starred" boolean DEFAULT false NOT NULL,
	"is_trashed" boolean DEFAULT false NOT NULL,
	"trashed_at" timestamp,
	"client_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"current_version_id" uuid,
	"thumbnail_path" text,
	"preview_generated" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"last_accessed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "folder_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folder_id" uuid NOT NULL,
	"user_id" uuid,
	"role" varchar(50),
	"permission" "permission" DEFAULT 'view' NOT NULL,
	"inherited" boolean DEFAULT false NOT NULL,
	"granted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"parent_id" uuid,
	"owner_id" uuid,
	"folder_type" "folder_type" DEFAULT 'personal' NOT NULL,
	"client_id" uuid,
	"is_root" boolean DEFAULT false NOT NULL,
	"color" varchar(20),
	"icon" varchar(50),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "storage_quotas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"quota_bytes" integer DEFAULT 26843545600 NOT NULL,
	"used_bytes" integer DEFAULT 0 NOT NULL,
	"file_count" integer DEFAULT 0 NOT NULL,
	"last_calculated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "storage_quotas_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "subtasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"is_completed" boolean DEFAULT false,
	"completed_at" timestamp,
	"completed_by" uuid,
	"position" integer DEFAULT 0,
	"due_date" timestamp,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_action_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001',
	"code" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"color" text DEFAULT '#6B7280',
	"icon" text DEFAULT 'clipboard',
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"description" text,
	"old_value" jsonb,
	"new_value" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"action" text NOT NULL,
	"field_name" text,
	"old_value" text,
	"new_value" text,
	"details" jsonb DEFAULT '{}'::jsonb,
	"performed_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"file_id" uuid,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer,
	"file_type" text,
	"uploaded_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_handoff_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"from_user_id" uuid,
	"to_user_id" uuid,
	"reason" text,
	"notes" text,
	"handoff_type" text DEFAULT 'reassign',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_task_id" uuid NOT NULL,
	"target_task_id" uuid NOT NULL,
	"link_type" text DEFAULT 'related' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"content" text NOT NULL,
	"is_internal" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_pools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"slug" text NOT NULL,
	"auto_assign_enabled" boolean DEFAULT false NOT NULL,
	"round_robin_enabled" boolean DEFAULT false NOT NULL,
	"max_tasks_per_user" integer,
	"eligible_user_ids" jsonb DEFAULT '[]'::jsonb,
	"eligible_roles" jsonb DEFAULT '[]'::jsonb,
	"eligible_departments" jsonb DEFAULT '[]'::jsonb,
	"action_type_ids" jsonb DEFAULT '[]'::jsonb,
	"priority_filter" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "task_pools_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "task_recurrence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"action_type_id" uuid,
	"client_id" uuid,
	"priority" text DEFAULT 'medium',
	"estimated_minutes" integer,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"frequency" text NOT NULL,
	"interval_value" integer DEFAULT 1 NOT NULL,
	"day_of_week" jsonb,
	"day_of_month" jsonb,
	"month_of_year" jsonb,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"due_time" timestamp,
	"lead_days" integer DEFAULT 0,
	"assign_to" uuid,
	"pool_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_generated_at" timestamp,
	"next_occurrence" timestamp,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"completed_by" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_visibility_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_type" text NOT NULL,
	"rule_value" text NOT NULL,
	"action_type_id" uuid,
	"client_id" uuid,
	"priority" text,
	"can_view" boolean DEFAULT true NOT NULL,
	"can_claim" boolean DEFAULT true NOT NULL,
	"can_edit" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid DEFAULT '00000000-0000-0000-0000-000000000001',
	"title" text NOT NULL,
	"description" text,
	"action_type_id" uuid,
	"source_type" text DEFAULT 'manual',
	"source_email_id" text,
	"source_call_id" uuid,
	"source_metadata" jsonb DEFAULT '{}'::jsonb,
	"client_id" uuid,
	"assigned_to" uuid,
	"assigned_at" timestamp,
	"assigned_by" uuid,
	"claimed_by" uuid,
	"claimed_at" timestamp,
	"status" text DEFAULT 'open',
	"priority" text DEFAULT 'medium',
	"due_date" timestamp,
	"due_time" timestamp,
	"alert_threshold_hours" integer DEFAULT 24,
	"completed_at" timestamp,
	"started_at" timestamp,
	"ai_confidence" integer,
	"ai_extracted_data" jsonb DEFAULT '{}'::jsonb,
	"next_action_type_id" uuid,
	"routed_from_task_id" uuid,
	"parent_task_id" uuid,
	"estimated_minutes" integer,
	"actual_minutes" integer,
	"progress_percent" integer DEFAULT 0,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"custom_fields" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"avatar_url" text,
	"role" "user_role" DEFAULT 'staff' NOT NULL,
	"phone" varchar(20),
	"is_active" boolean DEFAULT true NOT NULL,
	"notification_preferences" jsonb DEFAULT '{"email":true,"sms":false,"dashboard":true}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "webhook_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar(255),
	"endpoint" varchar(100) NOT NULL,
	"source" varchar(100),
	"status" "webhook_status" DEFAULT 'received' NOT NULL,
	"http_method" varchar(10) DEFAULT 'POST' NOT NULL,
	"headers" jsonb,
	"raw_payload" jsonb,
	"parsed_data" jsonb,
	"ai_parsing_used" boolean DEFAULT false,
	"ai_confidence" integer,
	"ai_summary" text,
	"ai_category" varchar(50),
	"error_message" text,
	"error_stack" text,
	"processing_time_ms" integer,
	"result_call_id" uuid,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_training_feedback" ADD CONSTRAINT "ai_training_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_transferred_to_id_users_id_fk" FOREIGN KEY ("transferred_to_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_processed_by_id_users_id_fk" FOREIGN KEY ("processed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_ai_insights" ADD CONSTRAINT "email_ai_insights_message_id_email_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."email_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_ai_insights" ADD CONSTRAINT "email_ai_insights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_ai_insights" ADD CONSTRAINT "email_ai_insights_suggested_client_id_clients_id_fk" FOREIGN KEY ("suggested_client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_message_id_email_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."email_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_connections" ADD CONSTRAINT "email_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_connection_id_email_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."email_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_thread_id_email_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."email_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sync_state" ADD CONSTRAINT "email_sync_state_connection_id_email_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."email_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sync_state" ADD CONSTRAINT "email_sync_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_activity" ADD CONSTRAINT "file_activity_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_activity" ADD CONSTRAINT "file_activity_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_activity" ADD CONSTRAINT "file_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_shares" ADD CONSTRAINT "file_shares_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_shares" ADD CONSTRAINT "file_shares_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_shares" ADD CONSTRAINT "file_shares_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_versions" ADD CONSTRAINT "file_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder_permissions" ADD CONSTRAINT "folder_permissions_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder_permissions" ADD CONSTRAINT "folder_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder_permissions" ADD CONSTRAINT "folder_permissions_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_quotas" ADD CONSTRAINT "storage_quotas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_action_types" ADD CONSTRAINT "task_action_types_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_activity" ADD CONSTRAINT "task_activity_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_activity" ADD CONSTRAINT "task_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_activity_log" ADD CONSTRAINT "task_activity_log_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_activity_log" ADD CONSTRAINT "task_activity_log_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_handoff_history" ADD CONSTRAINT "task_handoff_history_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_handoff_history" ADD CONSTRAINT "task_handoff_history_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_handoff_history" ADD CONSTRAINT "task_handoff_history_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_links" ADD CONSTRAINT "task_links_source_task_id_tasks_id_fk" FOREIGN KEY ("source_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_links" ADD CONSTRAINT "task_links_target_task_id_tasks_id_fk" FOREIGN KEY ("target_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_links" ADD CONSTRAINT "task_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_notes" ADD CONSTRAINT "task_notes_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_notes" ADD CONSTRAINT "task_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_pools" ADD CONSTRAINT "task_pools_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_recurrence" ADD CONSTRAINT "task_recurrence_action_type_id_task_action_types_id_fk" FOREIGN KEY ("action_type_id") REFERENCES "public"."task_action_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_recurrence" ADD CONSTRAINT "task_recurrence_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_recurrence" ADD CONSTRAINT "task_recurrence_assign_to_users_id_fk" FOREIGN KEY ("assign_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_recurrence" ADD CONSTRAINT "task_recurrence_pool_id_task_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."task_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_recurrence" ADD CONSTRAINT "task_recurrence_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_steps" ADD CONSTRAINT "task_steps_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_steps" ADD CONSTRAINT "task_steps_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_visibility_rules" ADD CONSTRAINT "task_visibility_rules_action_type_id_task_action_types_id_fk" FOREIGN KEY ("action_type_id") REFERENCES "public"."task_action_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_visibility_rules" ADD CONSTRAINT "task_visibility_rules_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_visibility_rules" ADD CONSTRAINT "task_visibility_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_action_type_id_task_action_types_id_fk" FOREIGN KEY ("action_type_id") REFERENCES "public"."task_action_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_source_call_id_calls_id_fk" FOREIGN KEY ("source_call_id") REFERENCES "public"."calls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_claimed_by_users_id_fk" FOREIGN KEY ("claimed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_next_action_type_id_task_action_types_id_fk" FOREIGN KEY ("next_action_type_id") REFERENCES "public"."task_action_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_result_call_id_calls_id_fk" FOREIGN KEY ("result_call_id") REFERENCES "public"."calls"("id") ON DELETE no action ON UPDATE no action;